// ====================================================================
  //  Classificador de imagem — Teachable Machine + TensorFlow.js
  //  Documentação da API:
  //  https://github.com/googlecreativelab/teachablemachine-community
  // ====================================================================

  let model, webcam, maxPredictions;
  let labelContainer = document.getElementById("label-container");
  let running = false;
  let rafId = null;

  // Correção para iOS: sem isso o vídeo congela em iPhone/iPad.
  let isIos = /iPhone|iPad/.test(window.navigator.userAgent);

  const $ = (id) => document.getElementById(id);
  const statusEl = $("status");

  function setStatus(msg, isError = false) {
    statusEl.className = "status" + (isError ? " error" : "");
    statusEl.innerHTML = (isError ? "&#9888; " : '<span class="dot">&#9679;</span> ') + msg;
  }

  // ----- 1. Carregar o modelo a partir da URL informada -----
  async function loadModel() {
    let url = $("modelUrl").value.trim();
    if (!url) { setStatus("informe a URL do modelo primeiro", true); return; }
    if (!url.endsWith("/")) url += "/";   // garante a barra final

    $("loadBtn").disabled = true;
    setStatus("baixando modelo…");

    try {
      const modelURL = url + "model.json";
      const metadataURL = url + "metadata.json";

      model = await tmImage.load(modelURL, metadataURL);
      maxPredictions = model.getTotalClasses();

      // Monta uma linha de leitura para cada classe
      labelContainer.innerHTML = "";
      for (let i = 0; i < maxPredictions; i++) {
        const row = document.createElement("div");
        row.className = "class-row";
        row.innerHTML =
          '<div class="meta"><span class="name">—</span><span class="pct">0%</span></div>' +
          '<div class="bar"><div class="fill"></div></div>';
        labelContainer.appendChild(row);
      }

      setStatus("modelo carregado &middot; " + maxPredictions + " classes prontas");
      $("startBtn").disabled = false;
      $("loadBtn").disabled = false;
    } catch (err) {
      console.error(err);
      setStatus("falha ao carregar. Verifique se a URL está correta e termina com /", true);
      $("loadBtn").disabled = false;
    }
  }

  // ----- 2. Ligar a webcam e começar o loop de predição -----
  async function start() {
    if (!model) return;
    $("startBtn").disabled = true;
    setStatus("solicitando acesso à câmera…");

    try {
      const flip = true;                       // espelha (sensação de espelho)
      webcam = new tmImage.Webcam(320, 320, flip);
      await webcam.setup();                     // pede permissão da câmera
      await webcam.play();

      const container = $("webcam-container");
      container.innerHTML = "";
      container.appendChild(webcam.canvas);

      running = true;
      $("stopBtn").disabled = false;
      setStatus("classificando ao vivo…");
      rafId = window.requestAnimationFrame(loop);
    } catch (err) {
      console.error(err);
      setStatus("não foi possível acessar a câmera (permissão negada?)", true);
      $("startBtn").disabled = false;
    }
  }

  // Loop principal: atualiza o frame e roda a predição
  async function loop() {
    if (!running) return;
    webcam.update();          // pega o frame mais recente da câmera
    await predict();
    rafId = window.requestAnimationFrame(loop);
  }

  // ----- 3. Rodar o modelo no frame atual e atualizar a UI -----
  async function predict() {
    const prediction = await model.predict(webcam.canvas);

    // Descobre a classe vencedora para destacá-la
    let leadIdx = 0;
    for (let i = 1; i < prediction.length; i++) {
      if (prediction[i].probability > prediction[leadIdx].probability) leadIdx = i;
    }

    const rows = labelContainer.children;
    for (let i = 0; i < prediction.length; i++) {
      const p = prediction[i];
      const pct = (p.probability * 100);
      const row = rows[i];
      row.querySelector(".name").textContent = p.className;
      row.querySelector(".pct").textContent = pct.toFixed(0) + "%";
      row.querySelector(".fill").style.width = pct + "%";
      row.classList.toggle("lead", i === leadIdx && p.probability > 0.5);
    }
  }

  // ----- 4. Parar a câmera -----
  async function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (webcam) await webcam.stop();
    $("webcam-container").innerHTML =
      '<div class="placeholder">câmera parada</div>';
    $("stopBtn").disabled = true;
    $("startBtn").disabled = false;
    setStatus("parado");
  }

  $("loadBtn").addEventListener("click", loadModel);
  $("startBtn").addEventListener("click", start);
  $("stopBtn").addEventListener("click", stop);

  // Permite carregar apertando Enter no campo de URL
  $("modelUrl").addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadModel();
  });