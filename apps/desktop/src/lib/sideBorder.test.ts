import { expect, test } from "bun:test";
import { Window } from "happy-dom";

const css = await Bun.file(new URL("../index.css", import.meta.url)).text();
const rules = css.slice(css.indexOf(".side-card {"));
const browser = new Window();
const style = browser.document.createElement("style");
style.textContent = rules.replaceAll("var(--border)", "#444444").replaceAll("var(--side-color)", "#00aaff");
browser.document.head.append(style);

for (const side of ["A", "B"]) {
  test(`side ${side} is neutral paused/running, dashed edited, and neutral again`, () => {
    const card = browser.document.createElement("section");
    card.className = "side-card";
    card.dataset.side = side;
    browser.document.body.append(card);
    for (const running of ["false", "true"]) {
      card.dataset.running = running;
      expect(browser.getComputedStyle(card).borderTopColor).toBe("#444444");
    }
    card.dataset.edited = "true";
    expect(browser.getComputedStyle(card).borderTopStyle).toBe("dashed");
    expect(browser.getComputedStyle(card).borderTopWidth).toBe("2px");
    expect(browser.getComputedStyle(card).borderTopColor).toBe("#00aaff");
    const receive = browser.document.createElement("div");
    receive.classList.add("receive-border");
    card.append(receive);
    expect(browser.getComputedStyle(receive).opacity).toBe("0");
    receive.setAttribute("data-receiving", "true");
    expect(browser.getComputedStyle(receive).opacity).toBe(".32");
    expect(browser.getComputedStyle(card).borderTopStyle).toBe("dashed");
    delete card.dataset.edited;
    expect(browser.getComputedStyle(card).borderTopColor).toBe("#444444");
    receive.removeAttribute("data-receiving");
    expect(browser.getComputedStyle(receive).opacity).toBe("0");
    card.remove();
  });
}
