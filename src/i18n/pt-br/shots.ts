// Brazilian Portuguese alt texts and captions of the screenshots (the images themselves show the
// English app).

import { localShots } from '../../app/content/shots';

export const SHOTS = localShots({
  newPack: {
    alt: 'O formulário “New texture pack” preenchido: nome My First Pack, edição Java, versão Java 26.3 (pack format 97.1), resolução 32× e uma descrição, ao lado da área para abrir um pack.',
    caption: 'Dê um nome ao pack e escolha a edição, a versão do jogo e a resolução.',
  },
  editor: {
    alt: 'O editor de texturas com a frente da fornalha aberta no editor de pixels 16×16, traços laranja em volta da abertura do fogo e a mesma pintura no modelo 3D da fornalha na prévia.',
    caption: 'Pintando a frente da fornalha: a prévia 3D mostra a mudança no modelo real do bloco.',
  },
  effects: {
    alt: 'A aba “Effects” com o preset Autumn aplicado: faixas de antes e depois das texturas recoloridas e os blocos de musgo da lista em tom marrom-alaranjado.',
    caption: 'Efeitos de um clique como Autumn mudam o estilo de todas as texturas de uma vez.',
  },
  packSettings: {
    alt: 'O cartão de versão do jogo na aba “Pack”: o pack foi feito para Java 26.3 (pack format 97.1) e também funciona do Java 1.21 (pack format 34) ao 26.3.',
    caption: 'Uma faixa de compatibilidade faz um pack carregar em várias versões do Java.',
  },
  export: {
    alt: 'A janela de exportação de My First Pack.zip: uma textura editada, os efeitos Autumn, feito para Java 26.3 com pack format 97.1, funciona do 1.21 ao 26.3, e um botão “Export .zip”.',
    caption: 'A janela de exportação resume o que vai no pack antes do download.',
  },
  openPack: {
    alt: 'Um pack existente aberto a partir de um .zip: o filtro “Edited” lista as três texturas alteradas e a textura de pedra azulada aparece no editor de pixels e em um bloco de pedra 3D.',
    caption: 'Ao abrir um .zip existente, as texturas alteradas do pack aparecem na lista, prontas para editar.',
  },
  skin2d: {
    alt: 'O editor de skins no modelo 64×64 com as áreas do corpo marcadas e a pintura espelhada ligada, traços azuis e amarelos no peito e nos braços, e a prévia 3D da skin à direita.',
    caption: 'Pintando no modelo 64×64 com espelhamento enquanto o modelo 3D se atualiza.',
  },
  skin3d: {
    alt: 'O editor de skins no modo de pintura 3D: o modelo está um pouco girado, o braço esquerdo escondido pela figura de partes do corpo e há tinta vermelha no peito.',
    caption: 'Pintando direto no modelo 3D, com um braço escondido para alcançar o corpo.',
  },
  skinPack: {
    alt: 'A janela “Make a skin pack”: pacote Adventure Crew com três skins, Wizard (braços clássicos, esta skin), Robot (braços finos) e Explorer (braços clássicos), e um botão “Download pack”.',
    caption: 'Três skins, clássicas e finas, em um único pacote de skins do Bedrock.',
  },
  shaderVanilla: {
    alt: 'O Shader Maker para Vanilla Java com controles de cor e tom (brilho, contraste e saturação) ao lado de uma prévia 3D ao vivo de uma ilha de grama.',
    caption: 'Um shader pack vanilla para Java: controles de cor com prévia ao vivo, sem mods.',
  },
  shaderIris: {
    alt: 'O Shader Maker para Iris e OptiFine ao pôr do sol: a prévia mostra luz quente e baixa e sombras longas, com presets e um controle da força do sol.',
    caption: 'Um shader pack de Iris / OptiFine com sombras reais, visto ao pôr do sol.',
  },
  vibrantVisuals: {
    alt: 'O Shader Maker para os Visuais Vibrantes do Bedrock: uma prévia clara com céu azul, presets, um controle de brilho do sol e avisos de que não precisa de mods.',
    caption: 'Criando um pacote de Visuais Vibrantes para o Bedrock, com prévia ao vivo.',
  },
  paint3d: {
    alt: 'O editor de texturas no modo 3D: um modelo de fornalha ocupa a tela com traços vermelhos pintados direto na face da frente, e ao lado a textura plana da frente da fornalha com os mesmos traços.',
    caption: 'Pintando direto na fornalha em 3D: cada face pinta a textura que mostra.',
  },
  mobGear: {
    alt: 'Um modelo de cavalo no editor de texturas com sela e armadura de couro para cavalo, com as opções de pelagem, marcas, idade, sela e armadura no painel lateral.',
    caption: 'Os mobs aparecem nos próprios modelos 3D, com selas e armaduras que você também pode pintar.',
  },
  mobParts: {
    alt: 'Um zumbi com armadura de ferro com o peitoral oculto na lista de partes, para pintar a camisa dele em 3D.',
    caption: 'Oculte uma parte, aqui o peitoral, para pintar o que ela cobre.',
  },
  convertPack: {
    alt: 'O conversor de texture packs com um pack de Java 26.2 escolhido (6 texturas) e Bedrock Edition como destino, com o botão “Convert to Bedrock”.',
    caption: 'Escolha um pack e para o que convertê-lo.',
  },
  convertResult: {
    alt: 'O resultado do conversor: 4 de 6 texturas convertidas de Java 26.2 para Bedrock, com botões para baixar e abrir no editor, e listas das texturas puladas com o motivo.',
    caption: 'O relatório mostra o que foi convertido e por que algo foi pulado.',
  },
  mergeSettings: {
    alt: '“Merge Texture Packs” com três packs em ordem de prioridade (Top Pack, Extras e um pack de Java 1.12.2), o nome do pack combinado, a escolha do ícone e Java 26.3 como versão de destino.',
    caption: 'Coloque os packs em ordem: o de cima vence todo conflito.',
  },
  mergeResult: {
    alt: 'O resultado: 3 packs combinados em um, com uma barra por pack mostrando arquivos usados, combinados e não usados, e a lista de conflitos.',
    caption: 'O resultado mostra quanto de cada pack entrou e cada conflito.',
  },
  modelEditShape: {
    alt: 'O editor de texturas com a espada de diamante escolhida na lista de itens: o sprite de 16×16 no editor de pixels e, na aba “Preview”, a espada plana com o botão “Edit shape” embaixo.',
    caption: 'Mostre um item na aba “Preview” e toque em “Edit shape” para abrir o editor de modelos.',
  },
  modelSpriteStart: {
    alt: 'O editor de modelos aberto na espada de diamante, um sprite plano sem cubos: os pontos de partida “3D item from sprite”, “Full cube”, “Slab”, “Cross (plant)” e “Empty”, na vista 3D e na aba “Model”.',
    caption: 'Um item plano começa sem cubos: escolha “3D item from sprite”.',
  },
  model3dSword: {
    alt: 'A espada de diamante como modelo 3D de 19 cubos com 1 pixel de espessura. O cubo 5 está escolhido na lista e aparece com setas de mover na vista 3D, com posição (9, 11, 7,5) e tamanho (5 × 1 × 1) na aba “Cube”.',
    caption: 'O sprite vira 19 cubos. Escolha um para mover, redimensionar ou mudar as faces.',
  },
  modelDisplay: {
    alt: 'A aba “Display” com “Third person”: a espada de diamante 3D na mão de um modelo de jogador e os campos de rotação (0, -90, 55), posição (0, 4, 0,5) e tamanho (0,85) da mão direita.',
    caption: '“Display” define como o modelo é segurado, usado e mostrado, cada um com prévia.',
  },
  modelFlatInventory: {
    alt: 'A aba “Model” com “Flat in the inventory” ativado, que mantém o ícone plano no inventário, no chão e nas molduras. No topo agora aparece item/diamond_sword_3d.json.',
    caption: '“Flat in the inventory” (1.21.4+) salva a forma 3D como um segundo modelo para a mão.',
  },
  modelBlock: {
    alt: 'O modelo do bloco de pedra transformado em degrau: um cubo de 16×8×16 como uma laje e um segundo cubo de 16×8×8 em cima de uma das metades, com posição e tamanho na aba “Cube”.',
    caption: 'Pedra transformada em degrau: o ponto de partida “Slab” e mais um cubo.',
  },
  pvpStart: {
    alt: 'O formulário Novo texture pack com Pack de PvP / FPS escolhido em Começar com, Também um pack de FPS ligado, edição Java, versão Java 1.8.9 e o botão Criar pack de PvP.',
    caption: 'Escolha Pack de PvP / FPS e a versão que você joga.',
  },
  pvpTweaks: {
    alt: 'O editor de texturas de um pack de PvP para Java 1.8.9: fire_layer_1 aberto no editor de pixels com as chamas na metade de baixo do quadro, e a aba PvP com Fogo baixo ligado, a altura em Mais baixo e Deixar os blocos de fogo como estão ligado.',
    caption: 'A aba PvP: cada ajuste é um interruptor, com as opções e os arquivos que ele muda.',
  },
  pvpCrosshair: {
    alt: 'icons.png ampliado, com o quadrado de 16×16 da mira no canto superior esquerdo selecionado e um losango cinza pintado dentro, ao lado dos corações e da armadura, e o cartão Mira personalizada com cinco desenhos e Desenhar a sua.',
    caption: 'Desenhar a sua: até o Java 1.20.1 a mira é o canto superior esquerdo do icons.png.',
  },
  pvpBedrock: {
    alt: 'Um pack de PvP do Bedrock: a textura do vidro vermelho, transparente por dentro e com a borda, e a aba PvP com Fogo baixo desligado e o motivo, acima de Vidro transparente ligado.',
    caption: 'No Bedrock, os ajustes que um pack não consegue fazer ficam desligados, com o motivo.',
  },
});
