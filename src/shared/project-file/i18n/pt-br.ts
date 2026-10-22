// Brazilian Portuguese text of project files and backups (English source: ./text.ts).

import type { ProjectFileLanguage } from './load';

const PT_BR: ProjectFileLanguage = {
  'shared.projectFile': {
    saved: '{file} salvo. Abra o arquivo aqui quando quiser para continuar editando.',
    saveFailed: 'Não foi possível salvar o arquivo de projeto.',
    opened: '“{name}” aberto',
    openedCopy: '“{name}” foi aberto como cópia. O que você já tinha continua igual.',
    copyName: '{name} (cópia)',
    untitled: 'Sem título',
    errors: {
      notZip: 'Isto não é um arquivo de projeto. Arquivos de projeto terminam em .tpmproject ou .tpmbackup.',
      notProject: 'Isto não é um arquivo de projeto do Texture Pack Maker. Para abrir um pack, use “Abrir um pack” no criador de texture packs.',
      damaged: 'Este arquivo de projeto está danificado e não pode ser aberto.',
      newer: 'Este arquivo foi salvo por uma versão mais nova do Texture Pack Maker (formato {version}). Recarregue a página para atualizar e abra de novo.',
      empty: 'Este arquivo não tem nenhum projeto.',
      item: '“{name}” está danificado e ficou de fora.',
    },
    types: {
      texturepack: 'Texture pack',
      skin: 'Skin',
      shader: 'Shader',
      cape: 'Capa',
      font: 'Fonte',
    },
    counts: {
      texturepack: '{count, plural, one {# texture pack} other {# texture packs}}',
      skin: '{count, plural, one {# skin} other {# skins}}',
      shader: '{count, plural, one {# shader} other {# shaders}}',
      cape: 'Sua capa',
      font: 'Sua fonte',
    },
    backup: {
      title: 'Fazer backup dos projetos',
      intro: 'Um só arquivo com todos os projetos deste navegador. Guarde em um lugar seguro, ou abra em outro navegador ou dispositivo para levar tudo junto.',
      none: 'Ainda não há projetos neste navegador.',
      contains: 'No backup',
      gameFiles: 'Os arquivos do próprio jogo não vão junto: eles são baixados de novo da Mojang quando você abre um projeto.',
      download: 'Baixar backup',
      done: 'Backup salvo: {file}',
      failed: 'Não foi possível fazer o backup.',
    },
    restore: {
      title: 'Restaurar um backup',
      intro: 'Salvo em {date}. Escolha o que trazer de volta para este navegador.',
      choose: 'Projetos',
      already: 'Já está aqui',
      existing: 'Já neste navegador',
      skip: 'Pular',
      keepBoth: 'Manter os dois',
      skipNote: 'Fica como está neste navegador',
      copyNote: 'Restaurado como cópia ao lado do seu',
      replaceNote: 'Substitui o deste navegador',
      selectAll: 'Selecionar tudo',
      selectNone: 'Desmarcar tudo',
      restore: '{count, plural, =0 {Restaurar} one {Restaurar # projeto} other {Restaurar # projetos}}',
      done: '{count, plural, one {# projeto restaurado} other {# projetos restaurados}}',
      failed: 'Não foi possível restaurar “{name}”.',
      edited: 'Editado {date}',
    },
    replace: {
      capeTitle: 'Substituir sua capa?',
      capeText: 'O criador de capas guarda uma capa por vez, então abrir “{name}” substitui a que você está fazendo. Salve-a antes como arquivo de projeto, se quiser mantê-la.',
      saveFirst: 'Salvar a atual antes',
      replace: 'Substituir',
    },
  },
};

/** Rightly the same as in English (the Portuguese site calls these things by their English names). */
export const SAME_AS_ENGLISH = ['shared.projectFile:types.texturepack', 'shared.projectFile:counts.texturepack', 'shared.projectFile:counts.skin', 'shared.projectFile:counts.shader'];

export default PT_BR;
