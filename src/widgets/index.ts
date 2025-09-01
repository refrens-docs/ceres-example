// Keep widgets globally accessible for templates as Handlebars helpers if needed
declare global {
  interface Window { Widgets?: any; }
}
(function () {
  function formatDateISO(dateStr: string) {
    var d = new Date(dateStr);
    if (isNaN(+d)) return dateStr;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  }

  // expose on window for reuse
  (window as any).Widgets = {
    formatDateISO: formatDateISO
  };
})();

export {};
