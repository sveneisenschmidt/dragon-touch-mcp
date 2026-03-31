document.getElementById("timestamp").textContent = new Date().toLocaleString();

function pass(id, msg) {
  const el = document.getElementById(id);
  el.textContent = "✓ " + msg;
  el.className = "result pass";
}

function fail(id, msg) {
  const el = document.getElementById(id);
  el.textContent = "✗ " + msg;
  el.className = "result fail";
}

// CSS: check computed background color of .red box
const box = document.querySelector(".box.red");
const bg = getComputedStyle(box).backgroundColor;
bg === "rgb(229, 62, 62)" ? pass("css-result", "Colors and flexbox render correctly") : fail("css-result", "Unexpected color: " + bg);

// JS
try {
  const arr = [1, 2, 3].map(x => x * 2);
  arr.join("") === "246" ? pass("js-result", "Arrow functions, Array.map work") : fail("js-result", "Unexpected result");
} catch (e) {
  fail("js-result", e.message);
}

// localStorage
try {
  localStorage.setItem("kiosk-test", "ok");
  localStorage.getItem("kiosk-test") === "ok" ? pass("storage-result", "Read/write works") : fail("storage-result", "Value mismatch");
  localStorage.removeItem("kiosk-test");
} catch (e) {
  fail("storage-result", e.message);
}

// Fetch local file via XHR (fetch() unreliable on file:// in older WebView)
const xhr = new XMLHttpRequest();
xhr.open("GET", "data.json");
xhr.onload = () => {
  try {
    const d = JSON.parse(xhr.responseText);
    d.status === "ok" ? pass("fetch-result", d.message) : fail("fetch-result", "Unexpected response");
  } catch (e) {
    fail("fetch-result", e.message);
  }
};
xhr.onerror = () => fail("fetch-result", "XHR error");
xhr.send();
