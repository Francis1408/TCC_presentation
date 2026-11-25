let captionIndex = 0;

const captions = [
    {
        file: 'images/dataset_extra_captions/2.png',
        caption: 'pxchar, pixel art sprite sheet, male humanoid, <span class="hl-bad">pale skin</span>, ' +
        'gray sleeveless armor, gold pauldron, brown shoulder strap with yellow buckle, ' +
        'yellow trim on left shoulder armor, large helmet with visor, yellow accents, ' +
        'dark gray body, <span class="hl-bad">white eyes</span>, <span class="hl-bad">dark pupil</span>, bare legs and feet</span>, <span class="hl-bad">pale skin</span>, ' +
        '<span class="hl-bad">red-brown footwear</span>, <span class="hl-bad">golden axe</span>, <span class="hl-bad">golden and brown staff</span>',
        grade: 'bad'
    },
    {
        file: 'images/dataset_extra_captions/185.png',
        caption: 'pxchar, pixel art sprite sheet, humanoid, pale skin, ' +
        '<span class="hl-bad">blue uniform with white trim on collar and cuffs </span>, black tie, ' +
        'purple bracer, purple gauntlet, <span class="hl-bad">green short</span>, rounded hair, ' +
        'purple headgear, visible ears, blue eyes, dark pupils, ' +
        '<span class="hl-bad">blue uniform with white trim on upper legs</span>, purple leggings, brown boots with white accents',
        grade: 'bad'
    },
    {
        file: 'images/dataset_extra_captions/228.png',
        caption: 'pxchar, pixel art sprite sheet, humanoid, pale skin, ' +
        '<span class="hl-good">green sleeveless tunic</span>, <span class="hl-good">beige undershirt</span>, brown belt, ' +
        'brown arm guards, <span class="hl-good">short spiky purple hair</span>, blue eyes, ' +
        'black pupils, brown shorts with black trim, brown boots',
        grade: 'good'
    },
    {
        file: 'images/dataset_extra_captions/679.png',
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
        '<span class="hl-good">light gray, or white buckle</span>, dark gray shoulder armor, ' +
        'helmet with visor, <span class="hl-good">black pigtails</span>, <span class="hl-bad">white eyes</span>, <span class="hl-bad">black pupils</span>, ' +
        '<span class="hl-bad">gray armor on legs and feet</span>, dark gray accents on knees and feet, black weapon',
        grade: 'regular'
    },
    {
        file: 'images/dataset_extra_captions/717.png',
        caption: 'pxchar, pixel art sprite sheet, humanoid female, pale skin, ' +
        '<span class="hl-good">pink sleeveless dress with black trim</span>, <span class="hl-bad">black belt with silver buckle</span>, ' +
        'blue hair, pink and purple headband, visible ears, yellow eyes, ' +
        'white pupils, <span class="hl-bad">pink and purple legs with black trim</span>, brown with pink trim at waist and ankle',
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