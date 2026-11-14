// Apply the saved theme before first paint to avoid a light/dark flash. A file rather than an
// inline script, so the production Content-Security-Policy can forbid inline scripts.
try {
  var t = JSON.parse(localStorage.getItem('aitutor.theme') || '"system"')
  if (t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches))
    document.documentElement.classList.add('dark')
} catch (e) {}
