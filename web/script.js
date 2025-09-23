/* global document */
(function () {
  if (typeof document === 'undefined') return;
  const links = document.querySelectorAll('a[href^="#"]');
  links.forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id && id.startsWith('#')) {
        e.preventDefault();
        const el = document.querySelector(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
})();


