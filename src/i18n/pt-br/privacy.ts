// Brazilian Portuguese privacy policy (see PrivacyText in src/tools/privacy/content.ts).

import { code, ext, link, strong } from '../../app/content/blocks';
import { PUBLISHER, REPO_URL, SITE_NAME } from '../../app/site';
import type { PrivacyText } from '../../tools/privacy/content';

export const PRIVACY: PrivacyText = {
  eyebrow: 'Privacidade',
  title: 'Política de privacidade',
  intro: `O ${SITE_NAME} foi feito para que seu trabalho nunca saia do seu dispositivo. Não há contas, anúncios nem rastreamento. Esta página explica o que isso significa na prática, para o site e para o app instalado.`,
  updated: 'Última atualização',
  sections: [
    {
      id: 'nothing-uploaded',
      title: 'Nada do que você cria é enviado',
      body: [
        [
          'Todas as ferramentas rodam no seu navegador. Os packs, skins, shaders e imagens que você abre, edita e exporta são processados no seu dispositivo e não são enviados para este site nem para ninguém. As exportações (',
          code('.zip'),
          ', ',
          code('.mcpack'),
          ', ',
          code('.png'),
          ') são criadas no seu dispositivo e salvas direto nos seus downloads.',
        ],
      ],
    },
    {
      id: 'no-tracking',
      title: 'Sem contas, anúncios ou rastreamento',
      body: [
        ['Não há cadastro nem login. O site não tem anúncios, cookies de rastreamento nem rastreadores de terceiros. Nenhum dado pessoal é coletado, vendido ou compartilhado.'],
        [
          'Para saber quais páginas e ferramentas são usadas, o site conta as visitas com o ',
          ext('https://www.cloudflare.com/web-analytics/', 'Cloudflare Web Analytics'),
          '. Ele não usa cookies, não segue você por outros sites nem cria um perfil seu: registra a página, o site de onde você veio, seu país e o tipo de navegador e dispositivo. O que você cria nunca faz parte disso.',
        ],
      ],
    },
    {
      id: 'on-your-device',
      title: 'O que fica guardado no seu dispositivo',
      body: [
        [
          strong('Seus projetos'),
          ' ficam salvos no armazenamento do navegador (IndexedDB) para você continuar depois. ',
          strong('Os arquivos do jogo'),
          ' que você baixou também ficam ali, para as ferramentas funcionarem offline. ',
          strong('Configurações'),
          ' como o tema claro ou escuro ficam no armazenamento local, e os arquivos do próprio app ficam em cache para ele abrir sem conexão.',
        ],
        ['Tudo isso fica no seu dispositivo. Ao excluir um projeto no app, ele some. Para apagar tudo, limpe os dados deste site nas configurações do navegador ou desinstale o app.'],
      ],
    },
    {
      id: 'other-services',
      title: 'Serviços aos quais seu navegador se conecta',
      body: [
        [
          'Quando você escolhe uma versão do jogo, seu navegador baixa os arquivos dela direto da Mojang (',
          code('piston-meta.mojang.com'),
          ', ',
          code('piston-data.mojang.com'),
          ', ',
          code('resources.download.minecraft.net'),
          '). Os arquivos do Bedrock vêm do repositório ',
          ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'),
          ' da Mojang pelo GitHub e pelo jsDelivr, e a lista de versões do Java vem do jsDelivr.',
        ],
        ['Se você busca a skin de um jogador pelo nome, esse nome é enviado ao playerdb.co (ou mc-heads.net) para encontrar a skin, que depois é carregada de textures.minecraft.net.'],
        ['Esses serviços recebem os dados comuns de uma requisição, como seu endereço IP, como qualquer site, e têm suas próprias políticas de privacidade. Nada do que você criou é enviado a eles.'],
      ],
    },
    {
      id: 'hosting',
      title: 'Hospedagem',
      body: [
        [
          'O site é hospedado no GitHub Pages. O GitHub pode registrar dados técnicos, como endereços IP, para operar e proteger o serviço; veja a ',
          ext('https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement', 'declaração de privacidade do GitHub'),
          '.',
        ],
      ],
    },
    {
      id: 'app',
      title: 'O app instalado',
      body: [['O app que você instala pelo navegador ou pela Microsoft Store é este mesmo site em uma janela própria. Tudo o que está nesta página vale para ele do mesmo jeito.']],
    },
    {
      id: 'children',
      title: 'Crianças',
      body: [[`O ${SITE_NAME} não coleta dados pessoais de ninguém, nem de crianças.`]],
    },
    {
      id: 'contact',
      title: 'Mudanças e dúvidas',
      body: [
        ['Se esta política mudar, esta página será atualizada com uma nova data.'],
        [`O ${SITE_NAME} é feito por ${PUBLISHER.name}. Dúvidas são bem-vindas como issue no `, ext(`${REPO_URL}/issues`, 'GitHub'), '. Há mais sobre o projeto na página ', link('/about', 'Sobre'), '.'],
      ],
    },
  ],
};
