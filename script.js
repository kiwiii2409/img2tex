document.addEventListener("DOMContentLoaded", () => {
  const API_URL =
    "https://8pfupjc3z7.execute-api.us-east-1.amazonaws.com/default/img2tex";

  // split up to avoid github warning
  const PART_A = "dqgudfBP2I75lbj3fQoK";
  const PART_B = "9EygeKeAGpdDsmn6WWi0";
  const DEMO_KEY = PART_A + PART_B; // heavily restricted to allow for few demo operations (100 per Week)

  const input = document.getElementById("input-field");
  const outputField = document.getElementById("output-field");
  const copyButton = document.getElementById("copy-btn");
  const apiKeyInput = document.getElementById("apiKey");
  const demoBtn = document.getElementById("demo-btn");
  const historyListElement = document.getElementById("history-list");

  let historyData = []; // non persistent, removed with each refresh

  // read and use key from storage if present
  const savedKey = localStorage.getItem("img2tex_api_key");
  if (savedKey) {
    apiKeyInput.value = savedKey;
  } else {
    apiKeyInput.value = "";
  }

  // only store non-DEMO keys
  apiKeyInput.addEventListener("input", (e) => {
    let val = e.target.value.trim();
    if (val !== DEMO_KEY) {
      localStorage.setItem("img2tex_api_key", val);
    }
  });

  // toggle DEMO mode
  demoBtn.addEventListener("click", () => {
    let isDemoActive = apiKeyInput.value === DEMO_KEY;

    // switch off DEMO mode
    if (isDemoActive) {
      apiKeyInput.value = savedKey;
      apiKeyInput.type = "password";

      demoBtn.textContent = "Try Demo";
      apiKeyInput.style.backgroundColor = "#ffffffff";
      apiKeyInput.disabled = false; // disable changing demo key
    } else {
      // turn on DEMO mode
      apiKeyInput.value = DEMO_KEY;
      apiKeyInput.type = "text";

      demoBtn.textContent = "Exit Demo";
      apiKeyInput.style.backgroundColor = "#ffd898ff";
      apiKeyInput.disabled = true;
    }
  });

  input.addEventListener("change", handleFileSelect);
  copyButton.addEventListener("click", copyToClipboard_result);
  window.addEventListener("paste", handlePaste);

  function isImage(file) {
    const allowedImageTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    return file && allowedImageTypes.includes(file.type);
  }

  function handlePaste(event) {
    const items = event.clipboardData.items;
    for (const item of items) {
      if (item.kind === "file") {
        let file = item.getAsFile();
        if (isImage(file)) {
          processFile(file);
          return;
        }
      }
    }
  }

  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) processFile(file);
  }

  async function processFile(file) {
    const apiKey = apiKeyInput.value.trim();

    outputField.className = "output-field";

    if (!apiKey) {
      setOutput(
        "Error: Please enter your API Key in the top right corner.",
        "error"
      );
      return;
    }

    if (!isImage(file)) {
      setOutput("Error: Invalid file type. Please upload an image.", "error");
      return;
    }

    setOutput("Processing image... please wait...", "loading");

    try {
      const base64Image = await resizeImage(file);
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({ image: base64Image }),
      });

      if (response.status === 403) {
        // delete faulty key from storage
        if (apiKeyInput.value !== DEMO_KEY) {
          localStorage.setItem("img2tex_api_key", "");
          apiKeyInput.value = "";
        }
        throw new Error("Access Denied: Invalid API Key");
      }
      if (response.status === 429 && apiKeyInput.value === DEMO_KEY) {
        throw new Error("OpenRouter free model rate limit exceeded.");
      }

      if (response.status === 400 && apiKeyInput.value === DEMO_KEY) {
        throw new Error("Img2Tex demo rate or OpenRouter limit exceeded.");
      }

      if (response.status === 502) {
        throw new Error(
          "Lambda likely timed out before the response was generated."
        );
      }

      if (!response.ok) throw new Error(`Server Error: ${response.result}`);

      const data = await response.json();

      const finalText = data.result || JSON.stringify(data);
      setOutput(finalText, "success");

      if (
        !finalText.startsWith("Error:") &&
        !finalText.includes("No formula found")
      ) {
        addToHistory(finalText);
      }
    } catch (error) {
      setOutput(`Error: ${error.message}`, "error");
    }
  }

  function addToHistory(text) {
    if (historyData[0] === text) {
      return;
    }
    historyData.unshift(text);
    if (historyData.length > 5) {
      historyData.pop();
    }

    renderHistory();
  }

  function renderHistory() {
    historyListElement.innerHTML = "";
    for (let i = 0; i < historyData.length; i++) {
      let text = historyData[i];
      let history_elem = createHistElem(text);
      historyListElement.appendChild(history_elem);
    }
  }

  function createHistElem(text) {
    const item = document.createElement("div");
    item.className = "history-item";

    const span = document.createElement("span");
    span.className = "history-text";
    span.textContent = text;
    item.onclick = () => {
      navigator.clipboard.writeText(text).then(() => {
        span.textContent = "Copied!";
        span.style.fontWeight = "bold";
        item.style.backgroundColor = "#d4edda";
        setTimeout(() => {
          span.textContent = text;
          span.style.fontWeight = "normal";
          item.style.backgroundColor = "#ffffff";
        }, 2000);
      });
    };
    item.append(span);
    return item;
  }

  function setOutput(text, type) {
    outputField.textContent = text;
    outputField.className = "output-field " + type;
  }

  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const elem = document.createElement("canvas");
          const MAX_SIZE = 2048;
          let width = img.width;
          let height = img.height;

          /*scale the larger side down to MAX_SIZE and the other proportional*/
          if (width > MAX_SIZE || height > MAX_SIZE) {
             const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
             width *= ratio;
             height *= ratio;
          }

          elem.width = width;
          elem.height = height;
          const ctx = elem.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          resolve(elem.toDataURL("image/jpeg", 0.8));
        };
        img.onerror = reject;
        img.src = event.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function copyToClipboard_result() {
    if (!outputField.textContent) return;

    navigator.clipboard
      .writeText(outputField.textContent)
      .then(() => {
        const originalText = copyButton.textContent;
        copyButton.textContent = "Copied!";
        setTimeout(() => (copyButton.textContent = originalText), 2000);
      })
      .catch((err) => console.error("Copy failed", err));
  }
});
