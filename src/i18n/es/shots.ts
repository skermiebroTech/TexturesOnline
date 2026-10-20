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
});
