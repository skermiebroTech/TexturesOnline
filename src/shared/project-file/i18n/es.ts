// Spanish text of project files and backups (English source: ./text.ts).

import type { ProjectFileLanguage } from './load';

const ES: ProjectFileLanguage = {
  'shared.projectFile': {
    saved: 'Se guardó {file}. Ábrelo aquí cuando quieras para seguir editando.',
    saveFailed: 'No se pudo guardar el archivo de proyecto.',
    opened: 'Se abrió «{name}»',
    openedCopy: 'Se abrió «{name}» como copia. El que ya tenías no cambia.',
    copyName: '{name} (copia)',
    untitled: 'Sin título',
    errors: {
      notZip: 'Esto no es un archivo de proyecto. Los archivos de proyecto terminan en .tpmproject o .tpmbackup.',
      notProject: 'Esto no es un archivo de proyecto de Texture Pack Maker. Para abrir un pack, usa «Abrir un pack» en el creador de texture packs.',
      damaged: 'Este archivo de proyecto está dañado y no se puede abrir.',
      newer: 'Este archivo se guardó con una versión más nueva de Texture Pack Maker (formato {version}). Recarga la página para actualizar y vuelve a abrirlo.',
      empty: 'Este archivo no tiene proyectos.',
      item: '«{name}» está dañado y se dejó fuera.',
    },
    types: {
      texturepack: 'Texture pack',
      skin: 'Skin',
      shader: 'Shader',
      cape: 'Capa',
      font: 'Fuente',
    },
    counts: {
      texturepack: '{count, plural, one {# texture pack} other {# texture packs}}',
      skin: '{count, plural, one {# skin} other {# skins}}',
      shader: '{count, plural, one {# shader} other {# shaders}}',
      cape: 'Tu capa',
      font: 'Tu fuente',
    },
    backup: {
      title: 'Hacer una copia de seguridad',
      intro: 'Un solo archivo con todos los proyectos de este navegador. Guárdalo en un lugar seguro, o ábrelo en otro navegador u otro dispositivo para llevártelo todo.',
      none: 'Todavía no hay proyectos en este navegador.',
      contains: 'En la copia de seguridad',
      gameFiles: 'Los archivos del propio juego no se incluyen: se vuelven a descargar de Mojang al abrir un proyecto.',
      download: 'Descargar copia de seguridad',
      done: 'Copia de seguridad guardada: {file}',
      failed: 'No se pudo crear la copia de seguridad.',
    },
    restore: {
      title: 'Restaurar una copia de seguridad',
      intro: 'Guardada el {date}. Elige qué quieres recuperar en este navegador.',
      choose: 'Proyectos',
      already: 'Ya está aquí',
      existing: 'Ya en este navegador',
      skip: 'Omitir',
      keepBoth: 'Conservar ambos',
      skipNote: 'Se queda como está en este navegador',
      copyNote: 'Se restaura como copia junto al tuyo',
      replaceNote: 'Reemplaza el de este navegador',
      selectAll: 'Seleccionar todo',
      selectNone: 'No seleccionar nada',
      restore: '{count, plural, =0 {Restaurar} one {Restaurar # proyecto} other {Restaurar # proyectos}}',
      done: '{count, plural, one {Se restauró # proyecto} other {Se restauraron # proyectos}}',
      failed: 'No se pudo restaurar «{name}».',
      edited: 'Editado {date}',
    },
    replace: {
      capeTitle: '¿Reemplazar tu capa?',
      capeText: 'El creador de capas guarda una sola capa, así que abrir «{name}» reemplaza la que estás haciendo. Si quieres conservarla, guárdala antes como archivo de proyecto.',
      saveFirst: 'Guardar la actual antes',
      replace: 'Reemplazar',
    },
  },
};

/** Rightly the same as in English (the Spanish site calls these things by their English names). */
export const SAME_AS_ENGLISH = ['shared.projectFile:types.texturepack', 'shared.projectFile:counts.texturepack', 'shared.projectFile:counts.skin', 'shared.projectFile:counts.shader'];

export default ES;
