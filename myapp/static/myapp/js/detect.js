const imageInput = document.getElementById("imageInput");
const imagePreview = document.getElementById("imagePreview");
const imageResult = document.getElementById("imageResult");
const predictButton = document.getElementById("predictButton");
const historyList = document.getElementById("historyList");
const fileUploadLabel = document.querySelector(".custom-file-upload");
const fullscreenModal = document.getElementById("fullscreenModal");
const fullscreenImage = document.getElementById("fullscreenImage");
const closeButton = document.getElementsByClassName("close")[0];
const labelOverlay = document.getElementById("labelOverlay");
const labelDetails = document.getElementById("labelDetails");
const authButton = $("#authButton");

let isViewingFinalResult = false;
let isImageFromHistory = false;
let currentLabels = [];
let originalImage = null;
let selectedFile = null;
let processingInterval;
let originalImageSize = { width: 0, height: 0 };
let currentImage = null;
let historyItems = [];
let allPredictions = [];
let finalPrediction;
const TOTAL_PREDICTIONS = 10;

$(document).ready(function () {
  checkLoginStatus();
  fetchInitialPredictionInfo();
});

function checkLoginStatus() {
  $.ajax({
    url: "/check_login_status/",
    method: "GET",
    success: function (response) {
      const authButton = $("#authButton");
      if (response.is_logged_in) {
        authButton.html(
          '<i class="fas fa-sign-out-alt"></i><span class="auth-text">ออกจากระบบ</span>'
        );
        authButton.attr("title", "Logout");
        authButton.removeClass("login").addClass("logout");
        authButton.off("click").on("click", function () {
          window.location.href = "/logout/";
        });
      } else {
        updatePredictionLimitInfo(TOTAL_PREDICTIONS, null);
        authButton.html(
          '<i class="fas fa-sign-in-alt"></i><span class="auth-text">ลงทะเบียน/เข้าสู่ระบบ</span>'
        );
        authButton.attr("title", "Login/Register");
        authButton.removeClass("logout").addClass("login");
        authButton.off("click").on("click", function () {
          window.location.href = "/login/";
        });
      }

      updateHistoryDisplay();
    },
    error: function (xhr, status, error) {
      console.error("Error checking login status:", error);
    },
  });
}

document.addEventListener("DOMContentLoaded", function () {
  function updateVisibility() {
    if (window.innerWidth <= 767) {
      var imageResult = document.querySelector(".image-result");
      var imageResultContent = document.getElementById("imageResult");
      if (imageResult && imageResultContent) {
        imageResult.style.display =
          imageResultContent.innerHTML.trim() !== "" ? "block" : "none";
      }

      var history = document.querySelector(".history");
      var historyList = document.getElementById("historyList");
      if (history && historyList) {
        history.style.display =
          historyList.children.length > 0 ? "block" : "none";
      }
    } else {
      var imageResult = document.querySelector(".image-result");
      var history = document.querySelector(".history");
      if (imageResult) imageResult.style.display = "";
      if (history) history.style.display = "";
    }
  }

  updateVisibility();

  window.addEventListener("resize", updateVisibility);

  var observer = new MutationObserver(updateVisibility);

  var imageResult = document.getElementById("imageResult");
  var historyList = document.getElementById("historyList");

  if (imageResult) {
    observer.observe(imageResult, { childList: true, subtree: true });
  }
  if (historyList) {
    observer.observe(historyList, { childList: true, subtree: true });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  updateHistoryDisplay();
});

imageInput.addEventListener("change", function () {
  const file = this.files[0];
  if (file) {
    selectedFile = file;
    const reader = new FileReader();
    imagePreview.innerHTML = "";
    reader.addEventListener("load", function () {
      originalImage = new Image();
      originalImage.onload = function () {
        originalImageSize.width = this.width;
        originalImageSize.height = this.height;
        currentImage = originalImage.cloneNode();
        resizeAndDisplayImage();

        currentLabels = [];
        labelOverlay.innerHTML = "";

        imageResult.innerHTML = "";
        document.getElementById("partResult").innerHTML = "";

        const predictionNavigation = document.getElementById(
          "predictionNavigation"
        );
        predictionNavigation.innerHTML = "";
        predictionNavigation.style.display = "none";

        const imageResultDiv = document.querySelector(".image-result");
        if (imageResultDiv) {
          imageResultDiv.style.display = "none";
        }

        const labelAreas = imagePreview.querySelectorAll(".label-area");
        labelAreas.forEach((area) => area.remove());

        isImageFromHistory = false;
        updatePredictButtonState();

        const searchResultsDiv = document.getElementById("searchResults");
        if (searchResultsDiv) {
          searchResultsDiv.innerHTML = "";
        }
      };
      originalImage.src = this.result;
      predictButton.classList.remove("d-none");
    });
    reader.readAsDataURL(file);
  } else {
    imagePreview.innerHTML = "<span>ตัวอย่างรูปภาพ</span>";
    predictButton.classList.add("d-none");
    currentImage = null;
    originalImage = null;

    currentLabels = [];
    labelOverlay.innerHTML = "";

    imageResult.innerHTML = "";
    document.getElementById("partResult").innerHTML = "";

    const progressContainer = document.querySelector(".progress-container");
    if (progressContainer) {
      progressContainer.innerHTML = "";
    }

    const imageResultDiv = document.querySelector(".image-result");
    if (imageResultDiv) {
      imageResultDiv.style.display = "none";
    }

    const searchResultsDiv = document.getElementById("searchResults");
    if (searchResultsDiv) {
      searchResultsDiv.innerHTML = "";
    }
  }
});

function resizeAndDisplayImage() {
  if (!currentImage) return;

  const aspectRatio = originalImageSize.width / originalImageSize.height;
  const maxWidth = imagePreview.clientWidth;
  const maxHeight = imagePreview.clientHeight;
  let newWidth, newHeight;

  if (aspectRatio > maxWidth / maxHeight) {
    newWidth = maxWidth;
    newHeight = maxWidth / aspectRatio;
  } else {
    newHeight = maxHeight;
    newWidth = maxHeight * aspectRatio;
  }

  imagePreview.innerHTML = "";
  const img = currentImage.cloneNode();
  img.style.width = newWidth + "px";
  img.style.height = newHeight + "px";
  imagePreview.appendChild(img);
}

function showFullscreenImage(imageSrc) {
  fullscreenImage.src = imageSrc;
  fullscreenModal.style.display = "flex";
  labelDetails.style.display = "none";

  fullscreenImage.onload = () => {
    updateLabelOverlay();
  };
}

function updateLabelOverlay() {
  labelOverlay.innerHTML = "";
  const imageRect = fullscreenImage.getBoundingClientRect();
  const containerRect = fullscreenImage.parentElement.getBoundingClientRect();

  const scaleX = imageRect.width / originalImageSize.width;
  const scaleY = imageRect.height / originalImageSize.height;

  const offsetX = (containerRect.width - imageRect.width) / 2;
  const offsetY = (containerRect.height - imageRect.height) / 2;

  currentLabels.forEach((label, index) => {
    const labelElement = document.createElement("div");
    labelElement.className = "label-area";
    labelElement.style.left = `${label.x * scaleX + offsetX}px`;
    labelElement.style.top = `${label.y * scaleY + offsetY}px`;
    labelElement.style.width = `${label.width * scaleX}px`;
    labelElement.style.height = `${label.height * scaleY}px`;
    labelElement.dataset.index = index;
    labelElement.addEventListener("click", handleLabelClick);
    labelOverlay.appendChild(labelElement);
  });
}

function handleResize() {
  if (fullscreenModal.style.display === "flex") {
    updateLabelOverlay();
  }
}

window.addEventListener("resize", handleResize);

function handleLabelClick(event) {
  event.stopPropagation();
  const index = event.target.dataset.index;
  const label = currentLabels[index];

  const labeledImageContainer = document.getElementById(
    "labeledImageContainer"
  );
  const labelText = document.getElementById("labelText");

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = label.width;
  canvas.height = label.height;

  ctx.drawImage(
    originalImage,
    label.x,
    label.y,
    label.width,
    label.height,
    0,
    0,
    label.width,
    label.height
  );

  labeledImageContainer.innerHTML = "";
  const labeledImage = document.createElement("img");
  labeledImage.src = canvas.toDataURL();
  labeledImageContainer.appendChild(labeledImage);

  labelText.innerHTML = `
    <h3>${label.part}</h3>
    <p>ผลการตรวจสอบ: ${label.prediction.predicted_class}</p>
    <p>ความน่าจะเป็น: ${(label.prediction.predicted_prob * 100).toFixed(2)}%</p>
  `;

  labelDetails.style.display = "block";
}

closeButton.onclick = function () {
  fullscreenModal.style.display = "none";
  fullscreenImage.style.clipPath = "none";
  fullscreenImage.style.transform = "none";
  labelDetails.style.display = "none";
};

fullscreenModal.addEventListener("click", (event) => {
  const fullscreenImage = document.querySelector(".fullscreen-image");

  if (labelDetails.style.display === "block") {
    if (!labelDetails.contains(event.target)) {
      labelDetails.style.display = "none";
    }
  } else {
    if (!fullscreenImage.contains(event.target)) {
      fullscreenModal.style.display = "none";
    }
  }
});

document
  .querySelector(".fullscreen-image")
  .addEventListener("click", (event) => {
    if (
      labelDetails.style.display === "block" &&
      !labelDetails.contains(event.target)
    ) {
      labelDetails.style.display = "none";
    }
    event.stopPropagation();
  });

labelDetails.addEventListener("click", (event) => {
  event.stopPropagation();
});

predictButton.addEventListener("click", function () {
  if (selectedFile) {
    uploadAndProcessImage(selectedFile);
  }
});

labelDetails.addEventListener("click", (event) => {
  event.stopPropagation();
});

function resetDisplayAndShowLoading() {
  const imageResultContent = document.getElementById("imageResult");
  const partResultContent = document.getElementById("partResult");
  const predictionNavigation = document.getElementById("predictionNavigation");

  imageResultContent.innerHTML = "";
  partResultContent.innerHTML = "";
  predictionNavigation.innerHTML = "";
  predictionNavigation.style.display = "none";

  imageResultContent.innerHTML = `
    <div class="loader-container">
      <div class="loader-content">
        <h4 id="loadingText">กำลังวิเคราะห์รูปภาพ</h4>
        <div class="loader-bar">
          <div class="loader-progress"></div>
        </div>
      </div>
    </div>
  `;
  imageResultContent.style.display = "flex";

  animateLoadingText();
}

function animateLoadingText() {
  const loadingText = document.getElementById("loadingText");
  let dots = "";
  const maxDots = 3;

  function updateDots() {
    dots = dots.length >= maxDots ? "" : dots + ".";
    loadingText.textContent = "กำลังวิเคราะห์รูปภาพ" + dots;
  }

  const intervalId = setInterval(updateDots, 500);

  loadingText.dataset.intervalId = intervalId;
}

function stopLoadingAnimation() {
  const loadingText = document.getElementById("loadingText");
  if (loadingText) {
    clearInterval(Number(loadingText.dataset.intervalId));
  }
}

function simulateProgressBarClicks() {
  const steps = document.querySelectorAll(".progress-step");
  let currentStep = 0;

  disableButtons();

  function clickStep() {
    if (currentStep < steps.length) {
      steps[currentStep].click();
      currentStep++;
      if (currentStep < steps.length) {
        setTimeout(clickStep, 400);
      } else {
        enableButtons();
      }
    }
  }

  clickStep();
}

function displayDetailedResults(response, isFromHistory = false) {
  allPredictions = response.results.all_results;
  finalPrediction = response.results.final_prediction;
  const imageResultContent = document.getElementById("imageResult");
  const partResultContent = document.getElementById("partResult");
  const predictionNavigation = document.getElementById("predictionNavigation");

  predictionNavigation.style.display = "block";
  predictionNavigation.innerHTML = '<div class="progress-container"></div>';
  const progressContainer = predictionNavigation.querySelector(
    ".progress-container"
  );

  let totalSteps =
    allPredictions.flatMap((faceResult) => Object.keys(faceResult)).length + 1;
  let stepWidth = 100 / totalSteps;

  allPredictions.forEach((faceResult, faceIndex) => {
    Object.keys(faceResult).forEach((part, partIndex) => {
      const step = document.createElement("div");
      step.className = "progress-step";
      step.style.width = `${stepWidth}%`;

      const bar = document.createElement("div");
      bar.className = "progress-bar";

      const label = document.createElement("span");
      label.className = "progress-label";
      label.textContent = part;

      step.appendChild(bar);
      step.appendChild(label);
      step.addEventListener("click", () => {
        showPredictionPart(faceIndex, part);
        updateProgressBar(
          faceIndex * Object.keys(faceResult).length + partIndex + 1
        );
        scrollToStep(step);
      });

      progressContainer.appendChild(step);
    });
  });

  const finalStep = document.createElement("div");
  finalStep.className = "progress-step";
  finalStep.style.width = `${stepWidth}%`;

  const finalBar = document.createElement("div");
  finalBar.className = "progress-bar";

  const finalLabel = document.createElement("span");
  finalLabel.className = "progress-label";
  finalLabel.textContent = "ผลลัพธ์";

  finalStep.appendChild(finalBar);
  finalStep.appendChild(finalLabel);
  finalStep.addEventListener("click", () => {
    showFinalPrediction();
    updateProgressBar(totalSteps);
    scrollToStep(finalStep);
  });

  progressContainer.appendChild(finalStep);

  if (!isFromHistory) {
    simulateProgressBarClicks();
  } else {
    showFinalPrediction();
  }

  imageResultContent.innerHTML = generateFinalResultHTML(finalPrediction);
  imageResultContent.style.display = "block";
}

function updateProgressBar(activeStep) {
  const steps = document.querySelectorAll(".progress-step");
  steps.forEach((step, index) => {
    if (index < activeStep) {
      step.classList.add("completed");
    } else {
      step.classList.remove("completed");
    }
    step.classList.toggle("active", index === activeStep - 1);
  });
}

function scrollToStep(stepElement) {
  const container = document.querySelector(".progress-container");
  const containerRect = container.getBoundingClientRect();
  const stepRect = stepElement.getBoundingClientRect();

  const scrollLeft =
    stepRect.left -
    containerRect.left +
    container.scrollLeft -
    containerRect.width / 2 +
    stepRect.width / 2;

  container.scrollTo({
    left: scrollLeft,
    behavior: "smooth",
  });
}

function showPredictionPart(faceIndex, part) {
  isViewingFinalResult = false;
  const prediction = allPredictions[faceIndex][part];
  const partResultContent = document.getElementById("partResult");
  const imagePreview = document.getElementById("imagePreview");

  if (prediction.bbox) {
    const [x, y, w, h] = prediction.bbox;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(originalImage, x, y, w, h, 0, 0, w, h);

    currentImage = new Image();
    currentImage.src = canvas.toDataURL();

    resizeAndDisplayImage();
  }

  partResultContent.innerHTML = `
    <h5>ผลการตรวจสอบ: ${part}</h5>
    <p>ผลการวิเคราะห์: <span class="badge ${
      prediction.predicted_class === "ภาพปลอม" ? "bg-danger" : "bg-success"
    }">${prediction.predicted_class}</span></p>
    <p>ความน่าจะเป็น: ${(prediction.predicted_prob * 100).toFixed(2)}%</p>
  `;

  document.getElementById("imageResult").style.display = "none";
  partResultContent.style.display = "block";
  imagePreview.onclick = null;
  const stepIndex =
    allPredictions
      .slice(0, faceIndex)
      .reduce((acc, face) => acc + Object.keys(face).length, 0) +
    Object.keys(allPredictions[faceIndex]).indexOf(part);
  updateProgressBar(stepIndex + 1);
}

function showFinalPrediction() {
  const imagePreview = document.getElementById("imagePreview");
  const partResultContent = document.getElementById("partResult");
  const imageResultContent = document.getElementById("imageResult");

  imagePreview.innerHTML = `<img src="${originalImage.src}" alt="Full Image" style="max-width: 100%; height: auto;">`;

  partResultContent.style.display = "none";
  imageResultContent.style.display = "block";

  isViewingFinalResult = true;

  let resultHtml = "";

  if (allPredictions && allPredictions.length > 0) {
    if (finalPrediction) {
      resultHtml += generateFinalResultHTML(finalPrediction);
    } else {
      resultHtml += "<h4 class='mb-3'>ไม่พบผลการตรวจสอบรวม</h4>";
    }

    resultHtml += "<h5 class='mb-3'>รายละเอียดการตรวจสอบแต่ละส่วน:</h5>";

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = originalImage.width;
    canvas.height = originalImage.height;
    ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);

    const labelAreas = imagePreview.querySelectorAll(".label-area");
    labelAreas.forEach((area) => area.remove());

    currentLabels = [];

    allPredictions.forEach((faceResult, index) => {
      resultHtml += `<h6>ใบหน้าที่ ${index + 1}:</h6>`;
      resultHtml += "<ul class='list-group mb-3'>";
      for (const [part, prediction] of Object.entries(faceResult)) {
        if (
          prediction &&
          prediction.predicted_class &&
          prediction.predicted_prob
        ) {
          const badgeClass =
            prediction.predicted_class === "ภาพปลอม"
              ? "bg-danger"
              : "bg-success";
          resultHtml += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
              ${part}
              <span class="badge ${badgeClass} rounded-pill">
                ${prediction.predicted_class} [${(
            prediction.predicted_prob * 100
          ).toFixed(2)}%]
              </span>
            </li>
          `;
          if (prediction.bbox && prediction.predicted_class === "ภาพปลอม") {
            drawBoundingBoxAndLabel(
              ctx,
              prediction,
              part,
              canvas.width,
              canvas.height
            );
          }
        }
      }
      resultHtml += "</ul>";
    });

    const labeledImg = new Image();
    labeledImg.onload = function () {
      currentImage = labeledImg;
      resizeAndDisplayImage();
    };
    labeledImg.src = canvas.toDataURL();
  } else {
    resultHtml = "<p>ไม่พบข้อมูลการตรวจสอบ</p>";
  }

  updateProgressBar(document.querySelectorAll(".progress-step").length);

  imageResultContent.innerHTML = resultHtml;
  imagePreview.onclick = function () {
    if (isViewingFinalResult) {
      showFullscreenImage(originalImage.src);
    }
  };
}

function generateFinalResultHTML(finalPrediction) {
  return `
    <h4 class="mb-3">ผลการตรวจสอบรวม: 
      <span class="badge ${
        finalPrediction.predicted_class === "ภาพปลอม"
          ? "bg-danger"
          : "bg-success"
      }">
        ${finalPrediction.predicted_class}
      </span> 
      [${(finalPrediction.predicted_prob * 100).toFixed(2)}%]
    </h4>
  `;
}

function displayResults(response, shouldAddToHistory = true) {
  const imageResultContent = document.getElementById("imageResult");
  imageResultContent.classList.add("has-result");

  stopLoadingAnimation();

  imageResultContent.innerHTML = "";

  displayDetailedResults(response);

  if (shouldAddToHistory && selectedFile) {
    addToHistory(
      selectedFile.name,
      response.results.final_prediction.predicted_class,
      originalImage.src,
      response
    );
  }
}

function drawBoundingBoxAndLabel(
  ctx,
  prediction,
  part,
  canvasWidth,
  canvasHeight
) {
  const [x, y, w, h] = prediction.bbox;
  const scaledX = (x / originalImageSize.width) * canvasWidth;
  const scaledY = (y / originalImageSize.height) * canvasHeight;
  const scaledW = (w / originalImageSize.width) * canvasWidth;
  const scaledH = (h / originalImageSize.height) * canvasHeight;

  ctx.strokeStyle = "red";
  ctx.lineWidth = 3;
  ctx.strokeRect(scaledX, scaledY, scaledW, scaledH);

  currentLabels.push({
    x: scaledX,
    y: scaledY,
    width: scaledW,
    height: scaledH,
    part: part,
    prediction: prediction,
  });
}

function getAverageColor(imageData) {
  let r = 0,
    g = 0,
    b = 0;
  for (let i = 0; i < imageData.data.length; i += 4) {
    r += imageData.data[i];
    g += imageData.data[i + 1];
    b += imageData.data[i + 2];
  }
  const pixelCount = imageData.data.length / 4;
  return `rgb(${Math.round(r / pixelCount)},${Math.round(
    g / pixelCount
  )},${Math.round(b / pixelCount)})`;
}

function getContrastColor(rgbColor) {
  const rgb = rgbColor.match(/\d+/g).map(Number);
  const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
  return brightness > 128 ? "black" : "white";
}

function addToHistory(imageName, prediction, imageData, fullResults) {
  const historyItem = {
    imageName,
    prediction,
    imageData,
    fullResults,
    searchResults: fullResults.search_results,
    createdAt: new Date().toISOString().slice(0, 19).replace("T", " "),
  };
  historyItems.unshift(historyItem);
  updateHistoryDisplay();
}

function updateHistoryDisplay() {
  historyList.innerHTML = "";
  const deleteAllButton = document.getElementById("deleteAllHistory");

  const isLoggedIn = document
    .querySelector(".auth-button")
    .classList.contains("logout");

  if (historyItems.length > 0 && isLoggedIn) {
    deleteAllButton.classList.remove("d-none");
  } else {
    deleteAllButton.classList.add("d-none");
  }

  historyItems.forEach((item, index) => {
    const listItem = document.createElement("li");
    listItem.className = "list-group-item d-flex align-items-center";

    const imgContainer = document.createElement("div");
    imgContainer.className = "history-img-container";
    const img = document.createElement("img");
    img.src = item.imageData;
    img.alt = item.imageName;
    img.className = "history-thumbnail";
    imgContainer.appendChild(img);

    const textContainer = document.createElement("div");
    textContainer.className =
      "history-text-container ms-2 flex-grow-1 d-flex justify-content-between align-items-center";
    textContainer.innerHTML = `
      <div class="history-name">${truncateText(item.imageName, 25)}</div>
      <div class="history-prediction">
        <span class="badge ${
          item.prediction === "ภาพปลอม" ? "bg-danger" : "bg-success"
        } rounded-pill">
          ${item.prediction}
        </span>
      </div>
    `;

    listItem.appendChild(imgContainer);
    listItem.appendChild(textContainer);

    if (isLoggedIn) {
      const deleteButton = document.createElement("button");
      deleteButton.className = "btn btn-sm btn-outline-danger ms-2";
      deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
      deleteButton.addEventListener("click", (e) => {
        e.stopPropagation();
        confirmDelete(index, item.createdAt);
      });
      listItem.appendChild(deleteButton);
    }

    listItem.addEventListener(
      "click",
      () => recallHistoryItem(index),
      predictButton.disabled === true
    );
    historyList.appendChild(listItem);
  });
}

function confirmDelete(index, createdAt) {
  Swal.fire({
    title: "ยืนยันที่จะลบหรือไม่?",
    text: "คุณจะไม่สามารถกู้คืนภาพที่ถูกลบได้!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
    confirmButtonText: "ใช่ ฉันต้องการลบมัน!",
  }).then((result) => {
    if (result.isConfirmed) {
      deleteHistoryItem(index, createdAt);
    }
  });
}

function deleteHistoryItem(index, createdAt) {
  const item = historyItems[index];

  const formattedCreatedAt = new Date(createdAt)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  fetch("/delete_history_item/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken"),
    },
    body: JSON.stringify({
      image_name: item.imageName,
      created_at: formattedCreatedAt,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        historyItems.splice(index, 1);
        updateHistoryDisplay();
      } else {
        alert(
          "เกิดข้อผิดพลาดในการลบข้อมูล :" + (data.error || "โปรดลองอีกครั้ง")
        );
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("เกิดข้อผิดพลาดในการลบข้อมูล");
    });
}

function deleteAllHistory() {
  Swal.fire({
    title: "ลบประวัติทั้งหมด",
    text: "คุณแน่ใจที่จะลบหรือไม่? หากลบแล้วคุณจะไม่สามารถกู้คืนภาพที่ถูกลบได้!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
    confirmButtonText: "ใช้ ฉันต้องการลบภาพทั้งหมด!",
    input: "checkbox",
    inputValue: 0,
    inputPlaceholder: "ฉันยืนยันที่จะลบภาพทั้งหมดในประวัติของฉัน",
    inputValidator: (result) => {
      return !result && "คุณจำเป็นต้องกดยืนยันในการลบภาพทั้งหมดก่อน";
    },
  }).then((result) => {
    if (result.isConfirmed) {
      fetch("/delete_all_history/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            historyItems = [];
            updateHistoryDisplay();
            Swal.fire(
              "ลบภาพเรียบร้อยแล้ว!",
              "เราได้ทำการลบภาพทั้งหมดในประวัติของคุณ",
              "เสร็จสิ้น"
            );
          } else {
            Swal.fire(
              "Error",
              "เกิดข้อผิดพลาดในการลบรูปทั้งหมดในประวัติของคุณ โปรดลองอีกครั้ง",
              "error"
            );
          }
        })
        .catch((error) => {
          console.error("Error:", error);
          Swal.fire(
            "Error",
            "เกิดข้อผิดพลาดในการลบรูปทั้งหมดในประวัติของคุณ",
            "error"
          );
        });
    }
  });
}

function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === name + "=") {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

document
  .getElementById("deleteAllHistory")
  .addEventListener("click", deleteAllHistory);

function truncateText(text, maxLength) {
  if (text.length > maxLength) {
    return text.substring(0, maxLength - 3) + "...";
  }
  return text;
}

function recallHistoryItem(index) {
  const item = historyItems[index];
  originalImage = new Image();
  originalImage.onload = () => {
    originalImageSize.width = originalImage.width;
    originalImageSize.height = originalImage.height;
    currentImage = originalImage.cloneNode();
    resizeAndDisplayImage();

    currentLabels = [];

    labelOverlay.innerHTML = "";

    const resultsToDisplay = {
      results: item.fullResults.results,
      search_results: item.fullResults.search_results,
    };
    displayDetailedResults(resultsToDisplay, true);

    displaySearchResults(item.fullResults.search_results);

    isImageFromHistory = true;
    updatePredictButtonState();

    showFinalPrediction();

    setTimeout(() => {
      const finalStep = document.querySelector(".progress-step:last-child");
      if (finalStep) {
        scrollToStep(finalStep);
      }
    }, 100);
  };
  originalImage.src = item.imageData;
}

function displaySearchResults(searchResults) {
  const searchResultsDiv = document.getElementById("searchResults");
  if (
    searchResults &&
    Array.isArray(searchResults) &&
    searchResults.length > 0
  ) {
    let resultHtml =
      '<h5>ผลการตรวจสอบภาพที่ใกล้เคียงในอินเทอร์เน็ต:</h5><div class="similar-images-grid">';
    searchResults.forEach((result) => {
      resultHtml += `
        <div class="similar-image-item">
          <a href="${result.url}" target="_blank" class="similar-image-link">
            <img src="${result.thumbnail}" alt="${result.name}" class="similar-image-thumbnail">
            <span class="similar-image-title">${result.name}</span>
          </a>
        </div>
      `;
    });
    resultHtml += "</div>";
    searchResultsDiv.innerHTML = resultHtml;
  } else {
    searchResultsDiv.innerHTML = "<p>ไม่พบเจอภาพที่ใกล้เคียงในอินเทอร์เน็ต</p>";
  }
}

function disableButtons() {
  predictButton.disabled = true;
  imageInput.disabled = true;
  fileUploadLabel.style.pointerEvents = "none";
  fileUploadLabel.style.opacity = "0.5";
}

function enableButtons() {
  imageInput.disabled = false;
  fileUploadLabel.style.pointerEvents = "auto";
  fileUploadLabel.style.opacity = "1";
  updatePredictButtonState();
}

function updatePredictButtonState() {
  if (isImageFromHistory) {
    predictButton.disabled = true;
    predictButton.classList.add("disabled");
  } else {
    predictButton.disabled = false;
    predictButton.classList.remove("disabled");
  }
}

window.addEventListener(
  "resize",
  debounce(function () {
    resizeAndDisplayImage();
  }, 250)
);

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
