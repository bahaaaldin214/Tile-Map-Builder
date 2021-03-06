import css from "./cssAnimations.js";

window.addEventListener("onbeforeunload", function(e) {
  if(!e) e = window.event;

  e.cancelBubble = true;
  e.returnValue = 'You sure you want to leave?';

  if (e.stopPropagation) {
      e.stopPropagation();
      e.preventDefault();
  }
});

function selectors(o, ...e){

  const length = e.length;
  for(let i = length; i--;){

    const element = e[i];
    o[element.slice(1)] = document.querySelector(element);
  }

}

function getInts(node){
  let ints = [];
  for(let i = node.length; i--;){
    ints[i] = parseInt(node[i].value);
  }
  return ints;
}

const controller = {}

class Project {

  constructor(){
    selectors(this, "#images", "#canvas", "#buttonsArray", "#layers", "#zoomedImage");

    this.mainContext = this.canvas.getContext("2d");

    this.zoomedImageContext = this.zoomedImage.getContext("2d");

    this.tileSize = undefined;
    this.tilesLength = undefined;
    this.scaledTileSize = undefined;

    this.canvasLength = innerHeight > innerWidth ? innerWidth : innerHeight - 20;

    this.canvas.height = this.canvasLength; this.canvas.width = this.canvasLength;
    this.zoomedImage.height = innerHeight; this.zoomedImage.width = innerWidth;

    this.currentLayer = undefined;
    this.selectedCanvas = null;
    this.selectedValue = -1;

    this.maps = [];
    this.values = [];
    this.imageNames = [];

    this.lastMouseType = "mouseup"

    this.handleMouse = this.handleMouse.bind(this);
  }

  setup(tileSize, tilesLength){
    this.tileSize = tileSize;
    this.tilesLength = tilesLength;
    this.scaledTileSize = this.canvasLength/tilesLength;
    this.layers.style.display = "block";
    this.canvas.style.display = "block";
    this.images.style.display = "block";
  }

  saveFile(url, name){

    const a = document.createElement("a");

    a.href = url;
    a.download = name;

    a.click();

  }

  handleMouse(e){

    const {zoomedImageContext, canvas: {offsetLeft, offsetTop}, scaledTileSize, zoomedImage, buttonsArray, selectedCanvas, lastMouseType, selectedValue, currentLayer, values} = this;
    this.lastMouseType = e.type !== "mousemove" ? e.type : lastMouseType;

    const map = currentLayer.tiles;

    if(e.type == "mousemove"){

        if(selectedCanvas && selectedCanvas.isZoomed) {

          const {height, width} = selectedCanvas.canvas;

          const ratio = innerHeight/height;
          const scaledTileSize = this.tileSize*ratio;
          const imageX = innerWidth/2 - width*ratio/2;

          const x = Math.floor((e.pageX - imageX)/(scaledTileSize))
          const y = Math.floor(e.pageY/(scaledTileSize));

          if(x < 0 || x > selectedCanvas.sprites[0].length -1) return;

          selectedCanvas.drawZoomed(zoomedImageContext);

          zoomedImageContext.fillStyle = "#153f46c0";
          zoomedImageContext.fillRect(x*scaledTileSize + imageX, y*scaledTileSize, scaledTileSize, scaledTileSize);
        }
    }

    if(e.type == "mouseup"){

        buttonsArray.children[buttonsArray.children.length - 1].style.display = "none";
        if(selectedCanvas && selectedCanvas.isZoomed){
          css.fadeOut.run(zoomedImage);

          selectedCanvas.isZoomed = false;
          return;
        }
    }

    if(lastMouseType == "mouseup" || !currentLayer) return;
    const x = Math.floor((e.pageX - offsetLeft)/scaledTileSize);
    const y = Math.floor((e.pageY - offsetTop )/scaledTileSize);

    if(y > map.length || y < 0 || x > map[0].length || x < 0) return;

    const info = values[selectedValue];
    if(selectedValue !== -1){
      for(let _x = 0; _x < info.wLength; _x++){
        for(let _y = 0; _y < info.hLength; _y++){
          map[y+_y][x+_x] = -1;
        }
      }
    }

    map[y][x] = selectedValue;

    this.draw(Math.min(10, Math.max(1, scaledTileSize*0.1)));

  }

  export(){

    const mapsTiles = Object.values(this.maps).map(map => map.tiles.map(column => column.slice(0, this.tilesLength)).flat(1));

    const map1 = [...mapsTiles[0]];
    const length = map1.length;

    for(let i = 1; i < mapsTiles.length; i++){
      const currentMap = mapsTiles[i];

      for(let j = 0; j < length; j++){

        const currentValue = currentMap[j];
        const firstMapValue = map1[j];

        if(currentValue == -1) { continue; }

        if(firstMapValue == -1) {

          map1[j] = currentValue;

        } else {

          if(Array.isArray(firstMapValue)) {
            firstMapValue.push(currentValue);
          } else {
            map1[j] = [firstMapValue, currentValue]
          }

        }

      }

    }
    this.saveFile(URL.createObjectURL(new Blob([JSON.stringify(map1)], {type: 'application/json'})), "tileMap.json");

  }

  exportValues(){
    const values = {};
    const images = this.imageNames;
    this.values.forEach(({x, y, wLength, hLength, imageId}) => {
      let object =  {
        x, y,
        w: wLength,
        h: hLength
      };
      const imageName = images[imageId];
      if(values[imageName]) {
        values[imageName].push(object);
      } else {
        values[imageName] = [object];
      }
    });

    this.saveFile(URL.createObjectURL(new Blob([JSON.stringify(values, null, '\t')], {type: 'application/json'})), "values.json");
  }

  async createImage(dataURI){

    return new Promise(function(r, e){
      const image = new Image();

      image.onload = () => r(image);

      image.onerror = () => e(new Error("Error loading image"));
      image.src = dataURI;

    });
  }

  newImage(image, valuesMap, values){

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = image.width;
    canvas.height = image.height;

    context.drawImage(image, 0, 0)

    const sprite = new Sprite(context, image);

    this.images.appendChild(canvas);

    sprite.spriteSheet(this, valuesMap, values);

  }

  saveImage(){

    this.draw(0, true);

    this.saveFile(this.canvas.toDataURL("image/png"), "tileMap.png");
    this.draw(Math.min(10, Math.max(1, this.scaledTileSize*0.1)));
  }

  newLayer(tiles){

    const {canvasLength, layers, tilesLength, maps} = this;
    const layer = new Layer(canvasLength, layers, tilesLength, tiles);

    layer.canvas.onclick = () => {

      this.currentLayer = layer;

    }

    layers.appendChild(layer.canvas);
    layers.appendChild(document.createElement("br"));
    maps.push(layer);

    this.currentLayer = layer;
    this.draw(Math.min(10, Math.max(1, this.scaledTileSize*0.1)));

  }

  draw(space, trueSize){

    const {mainContext, canvas, canvasLength, scaledTileSize, maps, values, tilesLength, tileSize} = this;

    mainContext.fillStyle = "#131325"
    mainContext.fillRect(0, 0, canvasLength, canvasLength);

    for(let i = maps.length; i--;){

      const map = maps[maps.length - i - 1];
      const bufferCanvas = map.buffer.canvas;

      map.draw(canvasLength, trueSize ? tileSize : scaledTileSize, values, space);

      mainContext.drawImage(bufferCanvas, 0, 0)
    }

  }

}

class Layer{

  constructor(canvasLength, layers, tilesLength, tiles){

    this.canvas = document.createElement("canvas");
    this.bufferCanvas = document.createElement("canvas");

    this.canvas.height = canvasLength; this.canvas.width = canvasLength;
    this.bufferCanvas.height = canvasLength; this.bufferCanvas.width = canvasLength;

    this.context = this.canvas.getContext("2d");
    this.buffer = this.bufferCanvas.getContext("2d");

    this.tiles = [];

    if(tiles){
      let k = 0;
      for(let i = 0; i < tilesLength; i++){
        let newColumn = [];
        for(let j = 0; j < tilesLength; j++){
          newColumn.push(tiles[k]);
          k++;
        }
        this.tiles.push(newColumn);
      }

    } else {
      for(let i = 0; i < tilesLength; i++){
        const newColumn = [];
        for(let j = 0; j < tilesLength; j++){

          newColumn.push(-1)
        }

        this.tiles.push(newColumn);
      }
    }


  }

  draw(canvasLength, scaledTileSize, values, space = 0){
    const {context, buffer, tiles} = this;

    context.fillStyle = "#131325"
    context.fillRect(0, 0, canvasLength, canvasLength);

    buffer.clearRect(0, 0, canvasLength, canvasLength);
    const tilesLength = tiles.length;

    for(let _x = 0; _x < tilesLength; _x++){
      for(let _y = 0; _y < tilesLength; _y++){
        const value = tiles[_y][_x];

        if(value == -1) { continue; }

        const {x, y, width, height, image, wLength, hLength} = values[value];
        buffer.drawImage(image, x, y, width*wLength, height*hLength, _x*scaledTileSize, _y*scaledTileSize, scaledTileSize*wLength-space, scaledTileSize*hLength-space)

      }
    }
    context.drawImage(buffer.canvas, 0, 0);
  }

}

class Sprite {
  constructor(context, image, sprites){

    this.context = context;
    this.canvas = context.canvas;

    this.sprites = sprites?sprites:[];

    this.id = undefined;
    this.image = image;

    this.x = 0;
    this.y = 0;
    this.width = image.width;
    this.height = image.height;

    this.wLength = 1;
    this.hLength = 1;

  }

  drawZoomed(zContext){

    const {canvas, context} = this;

    const zCanvas = zContext.canvas;

    const ratio = innerHeight/canvas.height;

    zContext.clearRect(0, 0, zCanvas.width, zCanvas.height);
    zContext.fillStyle = "#00000088"

    const imageX = innerWidth/2 - canvas.width*ratio/2;
    zContext.fillRect(0, 0, zCanvas.width, zCanvas.height);
    zContext.drawImage(canvas, imageX, 0, canvas.width*ratio, canvas.height*ratio);
  }

  zoom(project){
    this.isZoomed  = true;
    this.drawZoomed(project.zoomedImageContext);

    if(this.sprites) {
      const {width, height} = this.canvas;
      const ratio = innerHeight/height;
      const imageX = innerWidth/2 - width*ratio/2;
      project.zoomedImage.onclick = (e) => {
        const x = Math.floor((e.pageX - imageX)/(project.tileSize*ratio));
        const y = Math.floor(e.pageY/(project.tileSize*ratio));

        const sprite = this.sprites[y][x];

        if(sprite == undefined) return;
        project.selectedValue = sprite;

      }
    }

    css.fadeIn.run(project.zoomedImage);

  }


  spriteSheet(project, valuesMap, values){
    project.values.push(...values);

    this.sprites = valuesMap;

    const {canvas, context, image} = this,
    tileSize = project.tileSize,
    drawnIds = {};

    context.fillStyle = "#cccccc80";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for(let i = values.length; i--;){

      const {id, x, y, wLength, hLength} = values[i];

      if(drawnIds[id]) continue;

      drawnIds[id] = true;
      context.drawImage(image, x, y, wLength*tileSize, hLength*tileSize,
        x, y, wLength*tileSize, hLength*tileSize);

      context.strokeStyle = "#153fc6";
      context.lineWidth = 5;
      context.strokeRect(x, y, wLength*tileSize, hLength*tileSize);
      context.lineWidth = 1;

    }

    canvas.onclick = (e) => {

      project.buttonsArray.children[project.buttonsArray.children.length - 1].style.display = "block";
      project.selectedCanvas = this;

      const rect = canvas.getBoundingClientRect();
      const currentX = e.pageX - rect.x;
      const currentY = e.pageY - rect.y;

      const ratio = rect.width/canvas.width;

      const x = Math.floor(currentX/(project.tileSize*ratio));
      const y = Math.floor(currentY/(project.tileSize*ratio));
      if(valuesMap[y] == undefined || valuesMap[y][x] == undefined) return;

      project.selectedValue = valuesMap[y][x];
    }

  }
}

function drawGrid(context, tileSize, color, width, height, text){

  context.strokeStyle = color;
  let i = 0;
  context.font = `10px Georgia`;
  context.fillStyle = "#000"
  for(let y = 0; y < height; y+=tileSize){
    for(let x = 0; x < width; x+=tileSize){

      if(text  !== undefined){
        context.fillText(text+i, x, tileSize+y);
      }
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x+tileSize, y);
      context.stroke();

      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x, y+tileSize);
      context.stroke();
      i++;
    }
  }
}

function drawNewImage(context, image, tileSize, values, realTileSize, id){
  context.clearRect(0, 0, 300, context.canvas.height);
  context.drawImage(image, 0, 0, 300, context.canvas.height);

  drawGrid(context, tileSize, "#153f46", context.canvas.width, context.canvas.height);

  const drawnIds = {};

  for(let i = values.length; i--;){

    const {id, x, y, wLength, hLength} = values[i];
    if(drawnIds[id]) continue;

    drawnIds[id] = true;
    context.drawImage(image, x, y, wLength*realTileSize, hLength*realTileSize,
      x/realTileSize*tileSize, y/realTileSize*tileSize, wLength*tileSize, hLength*tileSize);

    context.fillStyle = "#000"
    context.font = tileSize+"px Georgia";
    context.fillText(id.toString(), x/realTileSize*tileSize, y/realTileSize*tileSize+tileSize);

    context.strokeStyle = "#153fc6";
    context.lineWidth = 3;
    context.strokeRect(x/realTileSize*tileSize, y/realTileSize*tileSize, wLength*tileSize, hLength*tileSize);
    context.lineWidth = 1;

  }
}

function drawSelected(image, context, tileSize, realTileSize, x, y, width, height){
  if(x < 0 || y < 0 || width <= 0 || height <= 0) return;
  context.drawImage(image,x*realTileSize, y*realTileSize, width*realTileSize, height*realTileSize,
  x*tileSize, y*tileSize, tileSize*width, tileSize*height);
}

function addValue([x, y], startCoords, values, project, image, imageId, valuesMap, array, canvas){

  let width = Math.abs(x-startCoords[0]);
  let height = Math.abs(y-startCoords[1]);

  let currentX = x > startCoords[0] ? startCoords[0] : x;
  let currentY = y > startCoords[1] ? startCoords[1] : y;

  let id = values.length+project.values.length;
  if(!array){
    values.push({x: currentX*project.tileSize, y: currentY*project.tileSize, image, id, imageId, width: project.tileSize, height: project.tileSize, wLength: width, hLength:height});
  }

  for(let _x = 0; _x < width; _x++){
    for(let _y = 0; _y < height; _y++){

      if(_y+currentY >= valuesMap.length || _x+currentX >= valuesMap[0].length || _y+currentY<0 || _x+currentX < 0) { return; }

        if(array){
          id = values.length+project.values.length;
          values.push({x: (currentX+_x)*project.tileSize, y: (currentY+_y)*project.tileSize, image, id, imageId, width: project.tileSize, height: project.tileSize, wLength: 1, hLength:1});

        }
        valuesMap[_y+currentY][_x+currentX] = id;

      }
    }

}

window.addEventListener("keyup", function(e){

  if(controller[e.key]){
    controller[e.key]();
  }
});

function newPorject(info, project){
  const [tileSize, tilesLength] = getInts(info.querySelectorAll("input"));

  if(isNaN(tileSize) || isNaN(tilesLength)) return;

  css.fadeOut.run(info);
  project.setup(tileSize, tilesLength);
  project.newLayer();

  project.canvas.addEventListener("mousedown", project.handleMouse);
  window.addEventListener("mouseup", project.handleMouse);
  window.addEventListener("mousemove", project.handleMouse);
  project.draw();
}

window.addEventListener("load", function(){

  const project = new Project();

  const imageInput = document.querySelector("#imageUpload");
  const [info, imageInfo, selecteUploadedValues] = document.querySelectorAll(".popUp");

  const imageUploadButton = imageInfo.querySelector("#uploadButton");

  const newImageCanvas  = imageInfo.querySelector("canvas").getContext("2d");

  const selectValues = imageInfo.querySelector("#selectValues");
  const addValueBut = selectValues.querySelector("#addValueButton");
  const addTilesBut = selectValues.querySelector("#addTilesButton");
  const imageName = selectValues.querySelector("#imageName");
  const valuesUpload = selectValues.querySelector("#valuesUpload");

  const imageNamesSelect = selecteUploadedValues.querySelector("#imageNamesSelect");
  const verfiyValues = selecteUploadedValues.querySelector("button");

  newImageCanvas.canvas.width = 300;

  imageInput.addEventListener("change", function(){
    project.imageNames.push(imageName.value);
    let imageId = project.imageNames.length - 1;
    const name = imageInput.value.split("\\").pop();

    const file = this.files[0];
    const reader = new FileReader();

    reader.onload = function(){

      project.createImage(this.result).then(image => {

        css.fadeInGrid.run(imageInfo);
        controller.Escape = function(){
          css.fadeOut.run(imageInfo);
        }
        const ratio = 300/image.width;
        let tileSize = ratio*project.tileSize;

        newImageCanvas.canvas.height = 300/image.width*image.height;

        let valuesMap = new Array(Math.floor(image.height/project.tileSize));

        for(let i = valuesMap.length; i--;){
          valuesMap[i] = new Array(Math.floor(image.width/project.tileSize)).fill(undefined);
        }

        let values = [];

        drawNewImage(newImageCanvas, image, tileSize, values, project.tileSize, project.values.length);

        let startCoords = [0, 0];
        let lastCoords = [];

        selectValues.style.display = "block";
        let lastMouseType = "";

        newImageCanvas.canvas.onmousedown = newImageCanvas.canvas.onmouseup = newImageCanvas.canvas.onmousemove = (e) => {

          const canvasCoords =newImageCanvas.canvas.getBoundingClientRect();
          let x = Math.floor((e.pageX - canvasCoords.x)/tileSize);
          let y = Math.floor((e.pageY - canvasCoords.y)/tileSize);

          if(e.type == "mousedown") {
            startCoords = [x, y];
            lastMouseType = "mousedown";
          }

          if(e.type == "mouseup") {
            x++;
            y++;
            lastCoords = [x, y];
            lastMouseType = "mouseup";
            drawNewImage(newImageCanvas, image, tileSize, values, project.tileSize);
            newImageCanvas.fillStyle = "#153fc680"
            newImageCanvas.fillRect((x > startCoords[0] ? startCoords[0] : x)*tileSize,  (y > startCoords[1] ? startCoords[1] : y)*tileSize, Math.abs(x-startCoords[0])*tileSize, Math.abs(y-startCoords[1])*tileSize);
          }
          if(e.type == "mousemove" && lastMouseType == "mousedown"){
            x++;
            y++;
            drawNewImage(newImageCanvas, image, tileSize, values, project.tileSize);
            newImageCanvas.fillStyle = "#153fc680"
            newImageCanvas.fillRect((x > startCoords[0] ? startCoords[0] : x)*tileSize,  (y > startCoords[1] ? startCoords[1] : y)*tileSize, Math.abs(x-startCoords[0])*tileSize, Math.abs(y-startCoords[1])*tileSize);
          }

        }

        addValueBut.onclick = function(){

          addValue(lastCoords, startCoords, values, project, image, imageId, valuesMap, false, newImageCanvas);
          drawNewImage(newImageCanvas, image, tileSize, values, project.tileSize);

        }

        addTilesBut.onclick = function(){
          addValue(lastCoords, startCoords, values, project, image, imageId, valuesMap, true, newImageCanvas);
          drawNewImage(newImageCanvas, image, tileSize, values, project.tileSize);

        }

        valuesUpload.onchange = function(){
            const privouseCommand = controller.Escape;
            controller.Escape = function(){
              css.fadeOut.run(selecteUploadedValues);
              controller.Escape = privouseCommand;
            }
            const file = this.files[0];
            const reader = new FileReader();

            reader.onload = function(){

              const json = JSON.parse(this.result);
              const imagesNames = Object.keys(json);

              while (imageNamesSelect.firstChild) {
                  imageNamesSelect.removeChild(imageNamesSelect.firstChild);
              }

              for(let i = imagesNames.length; i--;){
                const newValue = document.createElement("option");
                const name = imagesNames[i];

                newValue.value = name;
                newValue.innerHTML = name;

                imageNamesSelect.appendChild(newValue);
              }

              verfiyValues.onclick = function(){
                const uploadValues = json[imageNamesSelect.value];
                let id = values.length+project.values.length;

                for(let i = uploadValues.length; i--;){
                  const {x, y, w, h} = uploadValues[i];

                  id = values.length+project.values.length;
                  values.push({x, y, image, id, imageId, width: project.tileSize, height: project.tileSize, wLength: w, hLength:h});

                  valuesMap[y/project.tileSize][x/project.tileSize] = id;
                }

                css.fadeOut.run(selecteUploadedValues);
                drawNewImage(newImageCanvas, image, tileSize, values, project.tileSize);
                imageName.value = imageNamesSelect.value;

              }

              css.fadeInGrid.run(selecteUploadedValues);
            }

            reader.readAsText(file);
        };


      imageUploadButton.onclick = () => {
        project.imageNames[imageId] = imageName.value;
        selectValues.style.display = "none";
        addValueBut.onclick = null;
        project.newImage(image, valuesMap, values);

        css.fadeOut.run(imageInfo);
        }
      });
    };

    reader.readAsDataURL(file);
  });

  document.querySelector("#zoomButton").onclick =  () =>     project.selectedCanvas.zoom(project);
  document.querySelector("#export").onclick = () => project.export();
  document.querySelector("#saveImage").onclick = () => project.saveImage();
  document.querySelector("#exportValues").onclick = () => project.exportValues();

  document.querySelector("#newLayer").onclick = () => project.newLayer();

  document.querySelector("#createButton").onclick = () => newPorject(info, project);

  document.querySelector("#eraser").onclick = controller.e = function(){
    project.selectedValue = -1;
    project.selectedCanvas = null;
  }

  document.querySelector("#layerUpload").addEventListener("change", function(){
    const file = this.files[0];
    const reader = new FileReader();

    reader.onload = function(){
      const map = JSON.parse(this.result);

      let layers = [[]];

      for(let i = 0; i < map.length; i++){
        const values = map[i];

        if(Array.isArray(values)){
            for(let j = 0; j < values.length; j++){
              if(!layers[j]){
                layers.push(new Array(map.length).fill(-1))
              }
              layers[j][i] = values[j];
            }
        } else {
          layers[0][i] = values;
        }

      }
      for(let i = 0; i < layers.length; i++){
        project.newLayer(layers[i]);
      }
    }

    reader.readAsText(file);

  });

  controller.Enter = function(){
    newPorject(info, project);
    delete controller.Enter;
  }

  css.fadeInGrid.run(info);

});
