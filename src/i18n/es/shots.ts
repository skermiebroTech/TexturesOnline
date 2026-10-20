// Spanish alt texts and captions of the screenshots (the images themselves show the English app).

import { localShots } from '../../app/content/shots';

export const SHOTS = localShots({
  newPack: {
    alt: 'El formulario «New texture pack» rellenado: nombre My First Pack, edición Java, versión Java 26.3 (pack format 97.1), resolución 32× y una descripción, junto a la zona para abrir un pack.',
    caption: 'Ponle nombre al pack y elige la edición, la versión del juego y la resolución.',
  },
  editor: {
    alt: 'El editor de texturas con el frente del horno abierto en el editor de píxeles de 16×16, trazos naranjas alrededor de la boca del fuego y la misma pintura en el modelo 3D del horno en la vista previa.',
    caption: 'Pintando el frente del horno: la vista previa 3D muestra el cambio en el modelo real del bloque.',
  },
  effects: {
    alt: 'La pestaña «Effects» con el preset Autumn aplicado: tiras de antes y después de texturas recoloreadas y los bloques de musgo de la lista en tono marrón anaranjado.',
    caption: 'Efectos de un clic como Autumn cambian el estilo de todas las texturas a la vez.',
  },
  packSettings: {
    alt: 'La tarjeta de versión del juego en la pestaña «Pack»: el pack está hecho para Java 26.3 (pack format 97.1) y también funciona de Java 1.21 (pack format 34) a 26.3.',
    caption: 'Un rango de compatibilidad permite que un pack cargue en varias versiones de Java.',
  },
  export: {
    alt: 'El diálogo de exportación de My First Pack.zip: una textura editada, los efectos de Autumn, hecho para Java 26.3 con pack format 97.1, funciona de 1.21 a 26.3, y un botón «Export .zip».',
    caption: 'El diálogo de exportación resume lo que va en el pack antes de descargarlo.',
  },
  openPack: {
    alt: 'Un pack existente abierto desde un .zip: el filtro «Edited» muestra sus tres texturas cambiadas y su textura de piedra azulada aparece en el editor de píxeles y en un bloque de piedra 3D.',
    caption: 'Al abrir un .zip existente, sus texturas cambiadas aparecen en la lista, listas para editar.',
  },
  skin2d: {
    alt: 'El editor de skins sobre la plantilla de 64×64 con las zonas del cuerpo marcadas y la pintura en espejo activada, trazos azules y amarillos en el pecho y los brazos, y la vista previa 3D de la skin a la derecha.',
    caption: 'Pintando sobre la plantilla de 64×64 en espejo mientras el modelo 3D se actualiza.',
  },
  skin3d: {
    alt: 'El editor de skins en modo de pintura 3D: el modelo está algo girado, el brazo izquierdo oculto con la figura de partes del cuerpo y hay pintura roja en el pecho.',
    caption: 'Pintando directamente sobre el modelo 3D, con un brazo oculto para llegar al cuerpo.',
  },
  skinPack: {
    alt: 'El diálogo «Make a skin pack»: pack llamado Adventure Crew con tres skins, Wizard (brazos clásicos, esta skin), Robot (brazos delgados) y Explorer (brazos clásicos), y un botón «Download pack».',
    caption: 'Tres skins, clásicas y delgadas, en un solo pack de skins de Bedrock.',
  },
  shaderVanilla: {
    alt: 'El Shader Maker para Vanilla Java con controles de color y tono (brillo, contraste y saturación) junto a una vista previa 3D en vivo de una isla de hierba.',
    caption: 'Un shader pack vanilla para Java: controles de color con vista previa en vivo, sin mods.',
  },
  shaderIris: {
    alt: 'El Shader Maker para Iris y OptiFine al atardecer: la vista previa muestra una luz cálida y baja y sombras largas, con presets y un control de intensidad del sol.',
    caption: 'Un shader pack de Iris / OptiFine con sombras reales, visto al atardecer.',
  },
  vibrantVisuals: {
    alt: 'El Shader Maker para Visuales vibrantes de Bedrock: una vista previa luminosa con cielo azul, presets, un control de brillo del sol y avisos de que no hacen falta mods.',
    caption: 'Creando un pack de Visuales vibrantes para Bedrock, con vista previa en vivo.',
  },
  paint3d: {
    alt: 'El editor de texturas en modo 3D: un modelo de horno ocupa el lienzo con trazos rojos pintados directamente en su cara frontal, y al lado la textura plana del frente del horno con los mismos trazos.',
    caption: 'Pintar directamente sobre el horno en 3D: cada cara pinta la textura que muestra.',
  },
  mobGear: {
    alt: 'Un modelo de caballo en el editor de texturas con silla de montar y armadura de cuero para caballo, con las opciones de pelaje, marcas, edad, silla y armadura en el panel lateral.',
    caption: 'Los mobs aparecen en sus propios modelos 3D, con sillas y armaduras que también puedes pintar.',
  },
  mobParts: {
    alt: 'Un zombi con armadura de hierro con la pechera oculta en la lista de partes, para poder pintar su camiseta en 3D.',
    caption: 'Oculta una parte, aquí la pechera, para pintar lo que tapa.',
  },
  convertPack: {
    alt: 'El conversor de texture packs con un pack de Java 26.2 elegido (6 texturas) y Bedrock Edition como destino, con el botón «Convert to Bedrock».',
    caption: 'Elige un pack y a qué convertirlo.',
  },
  convertResult: {
    alt: 'El resultado del conversor: 4 de 6 texturas convertidas de Java 26.2 a Bedrock, con botones para descargar y abrir en el editor, y listas de texturas omitidas con su motivo.',
    caption: 'El informe muestra qué se convirtió y por qué se omitió algo.',
  },
  mergeSettings: {
    alt: '«Merge Texture Packs» con tres packs por orden de prioridad (Top Pack, Extras y un pack de Java 1.12.2), el nombre del pack combinado, la elección de icono y Java 26.3 como versión de destino.',
    caption: 'Ordena los packs: el de arriba gana en cada conflicto.',
  },
  mergeResult: {
    alt: 'El resultado: 3 packs combinados en uno, con una barra por pack que muestra los archivos usados, combinados y no usados, y la lista de conflictos.',
    caption: 'El resultado muestra cuánto de cada pack se incluyó y cada conflicto.',
  },
  modelEditShape: {
    alt: 'El editor de texturas con la espada de diamante elegida en la lista de ítems: su sprite de 16×16 en el editor de píxeles y, en la pestaña «Preview», la espada plana con el botón «Edit shape» debajo.',
    caption: 'Muestra un ítem en la pestaña «Preview» y pulsa «Edit shape» para abrir el editor de modelos.',
  },
  modelSpriteStart: {
    alt: 'El editor de modelos abierto con la espada de diamante, un sprite plano sin cubos: los puntos de partida «3D item from sprite», «Full cube», «Slab», «Cross (plant)» y «Empty», en la vista 3D y en la pestaña «Model».',
    caption: 'Un ítem plano empieza sin cubos: elige «3D item from sprite».',
  },
  model3dSword: {
    alt: 'La espada de diamante como modelo 3D de 19 cubos de 1 píxel de grosor. El cubo 5 está elegido en la lista y se ve con flechas para moverlo en la vista 3D, con su posición (9, 11, 7,5) y tamaño (5 × 1 × 1) en la pestaña «Cube».',
    caption: 'El sprite se convierte en 19 cubos. Elige uno para moverlo, cambiar su tamaño o sus caras.',
  },
  modelDisplay: {
    alt: 'La pestaña «Display» con «Third person»: la espada de diamante 3D en la mano de un modelo de jugador y los campos de giro (0, -90, 55), posición (0, 4, 0,5) y tamaño (0,85) de la mano derecha.',
    caption: '«Display» define cómo se sostiene, se lleva y se muestra el modelo, cada uno con vista previa.',
  },
  modelFlatInventory: {
    alt: 'La pestaña «Model» con «Flat in the inventory» activado, que mantiene el icono plano en el inventario, en el suelo y en los marcos. Arriba ahora pone item/diamond_sword_3d.json.',
    caption: '«Flat in the inventory» (1.21.4+) guarda la forma 3D como un segundo modelo para la mano.',
  },
  modelBlock: {
    alt: 'El modelo del bloque de piedra convertido en escalón: un cubo de 16×8×16 como una losa y un segundo cubo de 16×8×8 encima de una de sus mitades, con su posición y tamaño en la pestaña «Cube».',
    caption: 'Piedra convertida en escalón: el punto de partida «Slab» y un cubo más.',
  },
});
