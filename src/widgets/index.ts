(function () {
  function formatDateISO(dateStr: string) {
    var d = new Date(dateStr);
    if (isNaN(+d)) return dateStr;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  }

  (window as any).Widgets = {
    formatDateISO: formatDateISO
  };
})();

export {};
