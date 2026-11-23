const Student = require('../models/Student');
const Seat = require('../models/Seat');
const Book = require('../models/Book');
const Issue = require('../models/Issue');

function sameFields(index, fields) {
  const keys = Object.keys(index.key || {}).sort();
  return keys.length === fields.length && fields.every(field => keys.includes(field));
}

async function listIndexes(collection) {
  try {
    return await collection.listIndexes().toArray();
  } catch (error) {
    if (error.codeName === 'NamespaceNotFound' || error.code === 26) return [];
    throw error;
  }
}

async function dropObsoleteUniqueIndexes(model, shouldDrop) {
  const indexes = await listIndexes(model.collection);
  for (const index of indexes) {
    if (index.name === '_id_' || !index.unique) continue;
    if (!shouldDrop(index)) continue;

    await model.collection.dropIndex(index.name);
    console.log(`[DB index repair] Removed obsolete unique index ${model.collection.collectionName}.${index.name}`);
  }
}

async function migrateLegacyFields() {
  const studentCollection = Student.collection;
  const seatCollection = Seat.collection;
  const bookCollection = Book.collection;
  const issueCollection = Issue.collection;

  // Convert records from the older rollNumber/firstName/lastName student model.
  await studentCollection.updateMany(
    { studentId: { $exists: false }, rollNumber: { $type: 'string' } },
    [
      { $set: {
        studentId: { $toUpper: { $trim: { input: '$rollNumber' } } },
        name: { $trim: { input: { $concat: [ { $ifNull: ['$firstName', ''] }, ' ', { $ifNull: ['$lastName', ''] } ] } } },
        status: { $switch: { branches: [
          { case: { $eq: ['$status', 'Active'] }, then: 'ACTIVE' },
          { case: { $eq: ['$status', 'Inactive'] }, then: 'INACTIVE' }
        ], default: { $ifNull: ['$status', 'ACTIVE'] } } }
      } }
    ]
  );

  await studentCollection.updateMany(
    { studentId: { $type: 'string' } },
    [ { $set: {
      studentId: { $toUpper: { $trim: { input: '$studentId' } } },
      nameNormalized: { $toLower: { $trim: { input: { $ifNull: ['$name', ''] } } } }
    } } ]
  );
  await studentCollection.updateMany({ $or: [{ email: '' }, { email: null }] }, { $unset: { email: '' } });

  // Normalize legacy seat state and move its previous assignment reference.
  await seatCollection.updateMany(
    { assignedStudent: { $exists: true }, student: { $exists: false } },
    [ { $set: { student: '$assignedStudent' } } ]
  );
  await seatCollection.updateMany(
    { status: { $in: ['Available', 'Assigned', 'Maintenance'] } },
    [ { $set: { status: { $switch: { branches: [
      { case: { $eq: ['$status', 'Available'] }, then: 'AVAILABLE' },
      { case: { $eq: ['$status', 'Assigned'] }, then: 'OCCUPIED' },
      { case: { $eq: ['$status', 'Maintenance'] }, then: 'MAINTENANCE' }
    ], default: '$status' } } } } ]
  );

  const assignedSeats = await seatCollection.find({ student: { $ne: null } }, { _id: 1, student: 1 }).toArray();
  for (const seat of assignedSeats) {
    await studentCollection.updateOne(
      { _id: seat.student, $or: [{ seat: null }, { seat: { $exists: false } }] },
      { $set: { seat: seat._id } }
    );
  }

  // Empty optional ISBN values must not collide in the current sparse unique index.
  await bookCollection.updateMany({ $or: [{ isbn: '' }, { isbn: null }] }, { $unset: { isbn: '' } });
  await bookCollection.updateMany(
    { title: { $type: 'string' } },
    [ { $set: {
      titleNormalized: { $toLower: { $trim: { input: '$title' } } },
      authorNormalized: { $toLower: { $trim: { input: { $ifNull: ['$author', ''] } } } }
    } } ]
  );

  // Rename the date fields and normalize statuses used by previous versions.
  await issueCollection.updateMany({ issueDate: { $exists: true }, issuedAt: { $exists: false } }, { $rename: { issueDate: 'issuedAt' } });
  await issueCollection.updateMany({ dueDate: { $exists: true }, dueAt: { $exists: false } }, { $rename: { dueDate: 'dueAt' } });
  await issueCollection.updateMany({ status: 'Issued' }, { $set: { status: 'ISSUED' } });
  await issueCollection.updateMany({ status: 'Returned' }, { $set: { status: 'RETURNED' } });
}

async function repairLegacyIndexes() {
  await migrateLegacyFields();

  // These fields belonged to earlier versions of this app. The current Student
  // model identifies a student by studentId; email is optional and not unique.
  await dropObsoleteUniqueIndexes(Student, index => {
    const keys = Object.keys(index.key || {});
    return keys.some(key => ['rollNumber', 'rollNo', 'email', 'studentCode', 'admissionNumber'].includes(key));
  });

  // Older Book models used a required unique bookCode. The current model uses
  // an optional sparse ISBN, so missing bookCode values must not block inserts.
  await dropObsoleteUniqueIndexes(Book, index => {
    const keys = Object.keys(index.key || {});
    if (keys.includes('bookCode') || keys.includes('code')) return true;
    if (sameFields(index, ['isbn']) && index.sparse !== true) return true;
    return false;
  });

  // Older seat schema used assignedStudent. The current relationship is Seat.student.
  await dropObsoleteUniqueIndexes(Seat, index => Object.keys(index.key || {}).includes('assignedStudent'));

  // The older Issue index matched status: "Issued"; the current enum is uppercase.
  await dropObsoleteUniqueIndexes(Issue, index => {
    const keys = Object.keys(index.key || {}).sort();
    const partialStatus = index.partialFilterExpression?.status;
    return keys.length === 2 && keys[0] === 'book' && keys[1] === 'student'
      && partialStatus !== 'ISSUED';
  });

  // Ensure the indexes defined by the current schemas exist after stale indexes
  // have been removed. If old data already contains duplicate canonical values,
  // report it without preventing the admin panel from starting. Controllers also
  // perform duplicate pre-checks before each insert.
  const models = [Student, Seat, Book, Issue];
  for (const model of models) {
    try {
      await model.createIndexes();
    } catch (error) {
      if (error.code === 11000) {
        console.warn(`[DB index repair] Could not build one or more unique indexes for ${model.collection.collectionName} because existing records contain duplicate values. New record forms will validate before saving. Details: ${error.message}`);
      } else {
        throw error;
      }
    }
  }

  console.log('[DB index repair] Current Student, Seat, Book and Issue index check completed.');
}

module.exports = repairLegacyIndexes;
