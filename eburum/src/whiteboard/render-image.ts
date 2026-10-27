export async function renderWhiteboardImage(
  svg: SVGSVGElement,
  title: string,
  portrait: boolean,
): Promise<Blob> {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy
    .querySelectorAll("[data-selection], [data-hit]")
    .forEach((node) => node.remove());
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const width = portrait ? 1280 : 2000,
    height = portrait ? 2000 : 1280;
  copy.setAttribute("width", String(width));
  copy.setAttribute("height", String(height));
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(copy)], {
      type: "image/svg+xml;charset=utf-8",
    }),
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height + 100;
    const context = canvas.getContext("2d");
    if (!context)
      throw Error("Esportazione non disponibile su questo browser.");
    context.fillStyle = "#0b1220";
    context.fillRect(0, 0, width, height + 100);
    context.fillStyle = "#ffffff";
    context.font = "bold 32px Arial";
    context.fillText(title || "Lavagna Eburum", 32, 60, width - 64);
    context.drawImage(image, 0, 100, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw Error("Immagine non generata. Riprova.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
