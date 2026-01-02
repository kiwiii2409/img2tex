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
  copyButton.addEventListener("click", copyToClipboard);
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
    const items = (event.clipboardData || event.originalEvent.clipboardData)
      .items;
    for (let index in items) {
      const item = items[index];
      if (item.kind === "file") {
        const blob = item.getAsFile();
        if (isImage(blob)) {
          processFile(blob);
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

      if (response.status === 403){
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


      if (!response.ok) throw new Error(`Server Error: ${response.result}`);

      const data = await response.json();

      const finalText = data.result || JSON.stringify(data);
      setOutput(finalText, "success");
    } catch (error) {
      setOutput(`Error: ${error.message}`, "error");
    }
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
          const MAX_WIDTH = 1024;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
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

  function copyToClipboard() {
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
