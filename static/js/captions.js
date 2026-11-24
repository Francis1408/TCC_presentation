let captionIndex = 0;

const captions = [
    {
        file: 'images/dataset_extra_captions/2.png',
        caption: 'pxchar, pixel art sprite sheet, male humanoid, pale skin, ' +
        'gray sleeveless armor, gold pauldron, brown shoulder strap with yellow buckle, ' +
        'yellow trim on left shoulder armor, large helmet with visor, yellow accents, ' +
        'dark gray body, white eyes, dark pupil, <span class="hl-bad">bare legs and feet</span>, <span class="hl-bad">pale skin</span>, ' +
        'red-brown footwear, golden axe, golden and brown staff',
        grade: 'bad'
    },
    {
        file: 'images/dataset_extra_captions/185.png',
        caption: 'pxchar, pixel art sprite sheet, humanoid, pale skin, ' +
        'blue uniform with white trim on collar and cuffs, black tie, ' +
        '<span class="hl-bad">purple bracer, purple gauntlet</span>, green short rounded hair, ' +
        'purple headgear, visible ears, blue eyes, dark pupils, ' +
        '<span class="hl-bad">blue uniform with white trim on upper legs</span>, purple leggings, brown boots with white accents',
        grade: 'bad'
    },
    {
        file: 'images/dataset_extra_captions/228.png',
        caption: 'pxchar, pixel art sprite sheet, humanoid, pale skin, ' +
        '<span class="hl-good">green sleeveless tunic</span>, beige undershirt, brown belt, ' +
        'brown arm guards, <span class="hl-good">short spiky purple hair</span>, blue eyes, ' +
        'black pupils, brown shorts with black trim, brown boots',
        grade: 'good'
    },
    {
        file: 'images/dataset_extra_captions/675.png',
        caption: 'pxchar, pixel art sprite sheet, male humanoid, ' +
        'pale skin, <span class="hl-good">brown jacket with white inner lining and gold trim</span>, ' +
        'blue belt, spiky red hair, <span class="hl-good">gold goggles with black straps</span>, ' +
        'green eyes, black pupils, blue pants with gold trim',
        grade: 'good'
    },
    {
        file: 'images/dataset_extra_captions/0.png',
        caption: 'pxchar, pixel art sprite sheet, humanoid, gray skin, ' +
        'gray armor, brown shoulder pads, brown belt with cream, ' +
        '<span class="hl-bad">light gray, or white buckle</span>, dark gray shoulder armor, ' +
        'helmet with visor, <span class="hl-good">black pigtails</span>, white eyes, black pupils, ' +
        'gray armor on legs and feet, dark gray accents on knees and feet, black weapon',
        grade: 'regular'
    },
    {
        file: 'images/dataset_extra_captions/717.png',
        caption: 'pxchar, pixel art sprite sheet, humanoid female, pale skin, ' +
        '<span class="hl-good">pink sleeveless dress with black trim</span>, black belt with silver buckle, ' +
        'blue hair, pink and purple headband, visible ears, yellow eyes, ' +
        '<span class="hl-bad">white pupils</span>, pink and purple legs with black trim, <span class="hl-bad">brown with pink trim at waist and ankle</span>',
        grade: 'regular'
    }
];

  function renderImage(index) {

    const selectedCaption = captions[index];

    const cardDiv = document.querySelector('#caption-example')

    // Create image
    const image = `<img src='${selectedCaption.file}'>`
  
    // Create text
    const text = `<p class="caption-text">${selectedCaption.caption}</p>`;

    // Create seal
    const seal = `<div class="seal ${selectedCaption.grade}">
    <img src='images/${selectedCaption.grade}.png'>
    <p>${selectedCaption.grade}</p></div>`;

    cardDiv.innerHTML = "";
    cardDiv.innerHTML = seal + text + image

  }


  function changeCaption(step) {

    // Adiciona no index global
    captionIndex += step;
    
    // Pega o total de captions
    let totalImages = captions.length;
    
    if (captionIndex < 0) {
      captionIndex = totalImages - 1;
    }

    // Pega o index da imagem atual
    let currentIndex = captionIndex % totalImages;

    // Escreve as informações da imagem atual
    renderImage(currentIndex)
   
  }

  export function renderCaptions() {

    const nextButton = document.querySelector(".caption-next");
    const prevButton = document.querySelector(".caption-prev");

    if(!nextButton && !prevButton) return;

    renderImage(captionIndex);

    nextButton.addEventListener('click', () => changeCaption(1))
    prevButton.addEventListener('click', () => changeCaption(-1))

  }