const electron = require('electron');
const cp = require('child_process');
const gpuLib = require('gpu.js');
const gpu = new GPU();


let canvas;
let ctx;
let imageData;
let data;

let maxIteration = 1000;
let x0;
let x1;
let xDist;
let y0;
let y1;
const width = 800;
const height = 800;

let new_x0;
let new_y0;
let new_x1;
let new_y1;

let gradient = new Array();
let gradientSize = 40;

function endPerf(message, startPerf) {
  console.log(message + " Timing: " + ((new Date()) - startPerf));
}

function startPerf() {
  return new Date();
}

function initGradient(colors) {
  let size = colors.length;
  let chunk = Math.ceil(gradientSize / (size - 1));
  for (let i = 0; i < size - 1; i++) {
    let diffColor = createDiffColor(colors[i], colors[i + 1]);
    writeGradient(diffColor, colors[i], i * chunk, (i + 1) * chunk);
  }
}

function createDiffColor(startColor, endColor) {
  return {
    red: endColor.red - startColor.red,
    green: endColor.green - startColor.green,
    blue: endColor.blue - startColor.blue,
  }
}

function writeGradient(diffColor, startColor, start, size) {
  for (let i = start; i <= size; i++) {
    let percent = i / size;
    gradient[i] = {
      red: Math.floor((diffColor.red * percent) + startColor.red),
      green: Math.floor((diffColor.green * percent) + startColor.green),
      blue: Math.floor((diffColor.blue * percent) + startColor.blue)
    };
  }
}

function init() {
  canvas = document.getElementById('graph');
  ctx = canvas.getContext('2d', { alpha: false });
  //width = window.innerWidth;
  //height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  imageData = ctx.getImageData(0, 0, width, height);
  data = imageData.data;

  let colors = new Array();
  colors[0] = { red: 255, green: 0, blue: 0 };
  colors[1] = { red: 0, green: 255, blue: 0 };
  colors[2] = { red: 0, green: 0, blue: 255 };
  //colors[3] = { red: 255, green: 255, blue: 0 };
  //colors[3] = { red: 255, green: 0, blue: 255 };
  //colors[3] = { red: 0, green: 255, blue: 255 };
  initGradient(colors);

  x0 = -2.8;
  x1 = 1.2;
  y0 = (x0 - x1) * height / (2 * width); //-1.2;
  y1 = -y0; //1.2;

  xDist = x1-x0;
}

function drawPoint(x, y, iteration) {
  //let start = startPerf();
  var index = y * (width * 4) + x * 4;

  if (iteration != 0) {
    let ratio = iteration % gradientSize;
    data[index] = gradient[ratio].red;
    data[index + 1] = gradient[ratio].green;
    data[index + 2] = gradient[ratio].blue;
    data[index + 3] = 255;
  } else {
    data[index] = 0;
    data[index + 1] = 0;
    data[index + 2] = 0;
    data[index + 3] = 255;
  }

  //endPerf('drawPoint', start);
}

const computeIterationMatrix = gpu.createKernel(function(iA, iB) {
  let iteration = 0;
  let a = 0.0;
  let b = 0.0;
  while (iteration < 1000) {
      let atemp = a * a - b * b + iA[this.thread.y*800+this.thread.x];
      let btemp = 2 * a * b + iB[this.thread.y*800+this.thread.x];
      if (a == atemp && b == btemp) {
          iteration = 1000;
          break;
      }
      a = atemp;
      b = btemp;
      iteration = iteration + 1;
      if (Math.abs(a + b) > 16) {
          break;
      }
  }
  return iteration;
}).setOutput([width, height]);

function computeMandelbrot() {
  let rx = (x1 - x0) / width;
  let ry = (y1 - y0) / height;
  let iterationA = new Array();
  let iterationB = new Array();
  for (let x = 0; x < width; x++) {
      let a0 = x0 + x * rx;
      for (let y = 0; y < height; y++) {
          let b0 = y0 + y * ry;
          let a = 0.0;
          let b = 0.0;
          iterationA.push(a0);
          iterationB.push(b0);
      }
  }
  let iteration = computeIterationMatrix(iterationA, iterationB);
  for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
          drawPoint(x, y, 1000 - iteration[x][y]);
      }
  }
  /*for (let x = 0; x < this.width; x++) {
      let a0 = fd.x0 + x * rx;
      for (let y = 0; y < this.height; y++) {
          let b0 = fd.y0 + y * ry;
          let a = 0.0;
          let b = 0.0;
          let iteration = 0;
          while (iteration < this.settings.maxIteration) {
              let atemp = a * a - b * b + a0;
              let btemp = 2 * a * b + b0;
              if (a == atemp && b == btemp) {
                  iteration = this.settings.maxIteration;
                  break;
              }
              a = atemp;
              b = btemp;
              iteration = iteration + 1;
              if (Math.abs(a + b) > 16) {
                  break;
              }
          }
          this.drawPoint(x, y, this.settings.maxIteration - iteration);
      }
  }*/
}

/*function computeMandelbrot() {
  let start = startPerf();
  var rx = (x1 - x0) / width;
  var ry = (y1 - y0) / height;
  for (var x = 0; x < width; x++) {
    var a0 = x0 + x * rx;
    for (var y = 0; y < height; y++) {
      var b0 = y0 + y * ry;
      var a = 0.0;
      var b = 0.0;
      var iteration = 0;
      while (iteration < maxIteration) {
        var atemp = a * a - b * b + a0;
        var btemp = 2 * a * b + b0;
        if (a == atemp && b == btemp) {
          iteration = maxIteration;
          break;
        }
        a = atemp;
        b = btemp;
        iteration = iteration + 1;
        if (Math.abs(a + b) > 16) {
          break;
        }
      }
      drawPoint(x, y, maxIteration - iteration);
    }
  }
  endPerf('computeMandelbrot', start);
}*/

function map(val, origRangeStart, origRangeEnd, destRangeStart, destRangeEnd) {
  return destRangeStart + (destRangeEnd - destRangeStart) * ((val - origRangeStart) / (origRangeEnd - origRangeStart));
}

function computeYfromX(e) {
  if (e.pageY < new_y0) {
    new_y1 = new_y0 - height * (Math.abs(new_x1 - new_x0) / width);
  } else {
    new_y1 = new_y0 + height * (Math.abs(new_x1 - new_x0) / width);
  }
}

window.addEventListener('mousemove', function (e) {
  if (e.buttons == 1) {
    new_x1 = e.pageX;
    computeYfromX(e);
    drawSelection();
  }
});

window.addEventListener('mousedown', function (e) {
  new_x0 = e.pageX;
  new_y0 = e.pageY;
});

window.addEventListener('mouseup', function (e) {
  let tempX0 = map(new_x0, 0, width, x0, x1);
  let tempX1 = map(new_x1, 0, width, x0, x1);
  let tempY0 = map(new_y0, 0, height, y0, y1);
  let tempY1 = map(new_y1, 0, height, y0, y1);
  if (tempX0 < tempX1) {
    x0 = tempX0;
    x1 = tempX1;
  } else {
    x1 = tempX0;
    x0 = tempX1;
  }
  if (tempY0 < tempY1) {
    y0 = tempY0;
    y1 = tempY1;
  } else {
    y1 = tempY0;
    y0 = tempY1;
  }
  drawMandelbrot();
  //console.log("zoom: 1/" + Math.ceil(xDist/(x1-x0)));
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "30px Arial bold";
  ctx.fillText("ZOOM: 1/" + Math.ceil(xDist/(x1-x0)), 10, 30);
  ctx.strokeStyle = "#000000";
  ctx.strokeText("ZOOM: 1/" + Math.ceil(xDist/(x1-x0)), 10, 30);
});

function drawSelection() {
  refresh();
  ctx.lineWidth = "1";
  ctx.strokeStyle = "red";
  let xDist = Math.abs(new_x0 - new_x1);
  let yDist = Math.abs(new_y0 - new_y1);
  if (new_x0 < new_x1 && new_y0 < new_y1) {
    ctx.strokeRect(new_x0, new_y0, xDist, yDist);
  } else if (new_x0 > new_x1 && new_y0 < new_y1) {
    ctx.strokeRect(new_x1, new_y0, xDist, yDist);
  } else if (new_x0 < new_x1 && new_y0 > new_y1) {
    ctx.strokeRect(new_x0, new_y1, xDist, yDist);
  } else if (new_x0 > new_x1 && new_y0 > new_y1) {
    ctx.strokeRect(new_x1, new_y1, xDist, yDist);
  }
}

function refresh() {
  //let start = startPerf();
  ctx.putImageData(imageData, 0, 0);
  //endPerf('refresh', start);
}

function drawMandelbrot() {
  //let start = startPerf();
  computeMandelbrot();
  refresh();
  //endPerf('drawMandelbrot', start);
}

document.addEventListener("DOMContentLoaded", (e) => {
  init();
  drawMandelbrot();
});

window.addEventListener("resize", (e) => {
  //init();
  //drawMandelbrot();
})

window.addEventListener("keypress", (e) => {
  switch (e.key) {
    case "+":
      maxIteration += 10;
      drawMandelbrot();
      break;
    case "-":
      maxIteration -= 10;
      drawMandelbrot();
      break;
  }
})