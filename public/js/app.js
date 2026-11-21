document.querySelectorAll('.show-password').forEach(button => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.target);
    if (!input) return;
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    button.textContent = visible ? 'Show' : 'Hide';
  });
});

document.querySelectorAll('.flash').forEach((flash, index) => {
  setTimeout(() => {
    if (flash.isConnected) {
      flash.style.opacity = '0';
      flash.style.transform = 'translateY(-5px)';
      flash.style.transition = '.3s ease';
      setTimeout(() => flash.remove(), 320);
    }
  }, 5000 + index * 500);
});

const dueDate = document.querySelector('input[name="dueAt"]');
if (dueDate && !dueDate.value) {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  dueDate.value = date.toISOString().slice(0, 10);
}
