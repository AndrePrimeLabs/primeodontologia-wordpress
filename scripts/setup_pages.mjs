import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function runWp(cmd) {
  try {
    return execSync(`studio wp ${cmd}`, { encoding: 'utf8' });
  } catch (err) {
    console.error('Error running WP command:', err.message);
    if (err.stdout) console.log(err.stdout);
    if (err.stderr) console.error(err.stderr);
    throw err;
  }
}

const pages = [
  {
    title: 'Meu Sorriso',
    slug: 'meu-sorriso',
    content: `<!-- wp:paragraph {"style":{"typography":{"fontSize":"1.125rem","lineHeight":"1.6"}},"textColor":"secondary"} -->
<p class="has-secondary-color has-text-color" style="font-size:1.125rem;line-height:1.6">Cada sorriso tem características próprias. Dentes desalinhados, espaços entre os dentes ou alterações na mordida motivam a busca por ortodontia — mas nada substitui o exame clínico presencial detalhado.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2,"textColor":"primary"} -->
<h2 class="wp-block-heading has-primary-color has-text-color">O que significa avaliar o sorriso?</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"textColor":"secondary"} -->
<p class="has-secondary-color has-text-color">A avaliação clínica na Prime Odontologia considera dentes, gengivas, função mastigatória, suporte ósseo e simetria facial. Nosso objetivo é planejar um cuidado que equilibre saúde biológica, estabilidade a longo prazo e estética harmônica.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2,"textColor":"primary"} -->
<h2 class="wp-block-heading has-primary-color has-text-color">Condições comuns avaliadas</h2>
<!-- /wp:heading -->

<!-- wp:columns {"style":{"spacing":{"blockGap":{"top":"1.5rem","left":"2rem"}}}} -->
<div class="wp-block-columns">
  <!-- wp:column {"style":{"spacing":{"padding":{"top":"1.5rem","bottom":"1.5rem","left":"1.5rem","right":"1.5rem"}},"border":{"radius":"6px","width":"1px","color":"var(--wp--preset--color--line)"}},"backgroundColor":"surface"} -->
  <div class="wp-block-column has-surface-background-color has-background" style="border-color:var(--wp--preset--color--line);border-width:1px;border-radius:6px;padding:1.5rem">
    <!-- wp:heading {"level":3,"style":{"typography":{"fontSize":"1.125rem","fontWeight":"700"}},"textColor":"primary"} -->
    <h3 class="wp-block-heading has-primary-color has-text-color" style="font-size:1.125rem;font-weight:700">Dentes Apinhados</h3>
    <!-- /wp:heading -->
    <!-- wp:paragraph {"style":{"typography":{"fontSize":"0.9375rem"}},"textColor":"secondary"} -->
    <p class="has-secondary-color has-text-color" style="font-size:0.9375rem">Falta de espaço no arco dental gerando sobreposição. Dificulta a higienização e favorece acúmulo de placa e tártaro.</p>
    <!-- /wp:paragraph -->
  </div>
  <!-- /wp:column -->

  <!-- wp:column {"style":{"spacing":{"padding":{"top":"1.5rem","bottom":"1.5rem","left":"1.5rem","right":"1.5rem"}},"border":{"radius":"6px","width":"1px","color":"var(--wp--preset--color--line)"}},"backgroundColor":"surface"} -->
  <div class="wp-block-column has-surface-background-color has-background" style="border-color:var(--wp--preset--color--line);border-width:1px;border-radius:6px;padding:1.5rem">
    <!-- wp:heading {"level":3,"style":{"typography":{"fontSize":"1.125rem","fontWeight":"700"}},"textColor":"primary"} -->
    <h3 class="wp-block-heading has-primary-color has-text-color" style="font-size:1.125rem;font-weight:700">Diastemas (Espaços)</h3>
    <!-- /wp:heading -->
    <!-- wp:paragraph {"style":{"typography":{"fontSize":"0.9375rem"}},"textColor":"secondary"} -->
    <p class="has-secondary-color has-text-color" style="font-size:0.9375rem">Espaçamentos entre os dentes que podem impactar a fonação, retenção alimentar e o aspecto visual do sorriso.</p>
    <!-- /wp:paragraph -->
  </div>
  <!-- /wp:column -->
</div>
<!-- /wp:columns -->

<!-- wp:columns {"style":{"spacing":{"blockGap":{"top":"1.5rem","left":"2rem"}}}} -->
<div class="wp-block-columns">
  <!-- wp:column {"style":{"spacing":{"padding":{"top":"1.5rem","bottom":"1.5rem","left":"1.5rem","right":"1.5rem"}},"border":{"radius":"6px","width":"1px","color":"var(--wp--preset--color--line)"}},"backgroundColor":"surface"} -->
  <div class="wp-block-column has-surface-background-color has-background" style="border-color:var(--wp--preset--color--line);border-width:1px;border-radius:6px;padding:1.5rem">
    <!-- wp:heading {"level":3,"style":{"typography":{"fontSize":"1.125rem","fontWeight":"700"}},"textColor":"primary"} -->
    <h3 class="wp-block-heading has-primary-color has-text-color" style="font-size:1.125rem;font-weight:700">Mordida Cruzada & Aberta</h3>
    <!-- /wp:heading -->
    <!-- wp:paragraph {"style":{"typography":{"fontSize":"0.9375rem"}},"textColor":"secondary"} -->
    <p class="has-secondary-color has-text-color" style="font-size:0.9375rem">Desencaixe funcional na mastigação que pode causar desgastes prematuros nos dentes e sobrecarga nas articulações (ATM).</p>
    <!-- /wp:paragraph -->
  </div>
  <!-- /wp:column -->

  <!-- wp:column {"style":{"spacing":{"padding":{"top":"1.5rem","bottom":"1.5rem","left":"1.5rem","right":"1.5rem"}},"border":{"radius":"6px","width":"1px","color":"var(--wp--preset--color--line)"}},"backgroundColor":"surface"} -->
  <div class="wp-block-column has-surface-background-color has-background" style="border-color:var(--wp--preset--color--line);border-width:1px;border-radius:6px;padding:1.5rem">
    <!-- wp:heading {"level":3,"style":{"typography":{"fontSize":"1.125rem","fontWeight":"700"}},"textColor":"primary"} -->
    <h3 class="wp-block-heading has-primary-color has-text-color" style="font-size:1.125rem;font-weight:700">Sobremordida Profunda</h3>
    <!-- /wp:heading -->
    <!-- wp:paragraph {"style":{"typography":{"fontSize":"0.9375rem"}},"textColor":"secondary"} -->
    <p class="has-secondary-color has-text-color" style="font-size:0.9375rem">Sobreposição vertical excessiva dos dentes anteriores superiores cobrindo quase totalmente os dentes inferiores.</p>
    <!-- /wp:paragraph -->
  </div>
  <!-- /wp:column -->
</div>
<!-- /wp:columns -->

<!-- wp:heading {"level":2,"textColor":"primary"} -->
<h2 class="wp-block-heading has-primary-color has-text-color">Qual é o próximo passo?</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"textColor":"secondary"} -->
<p class="has-secondary-color has-text-color">Agende uma consulta de avaliação presencial no bairro Lourdes em Belo Horizonte. Conversaremos abertamente sobre seus objetivos, apresentando um escaneamento digital de alta precisão e opções individualizadas.</p>
<!-- /wp:paragraph -->

<!-- wp:buttons {"style":{"spacing":{"margin":{"top":"2rem","bottom":"2.5rem"}}}} -->
<div class="wp-block-buttons" style="margin-top:2rem;margin-bottom:2.5rem">
  <!-- wp:button {"backgroundColor":"accent","textColor":"background","style":{"border":{"radius":"6px"},"typography":{"fontSize":"1rem","fontWeight":"600"}}} -->
  <div class="wp-block-button"><a class="wp-block-button__link has-background-color has-accent-background-color has-text-color has-background-color wp-element-button" href="https://wa.me/5531992893060" target="_blank" rel="noopener noreferrer" style="border-radius:6px;font-size:1rem;font-weight:600">Agendar Avaliação no WhatsApp</a></div>
  <!-- /wp:button -->
</div>
<!-- /wp:buttons -->

<!-- wp:paragraph {"style":{"typography":{"fontSize":"0.8125rem"}},"textColor":"secondary"} -->
<p class="has-secondary-color has-text-color" style="font-size:0.8125rem"><em>Nota informativa: Este conteúdo tem caráter exclusivamente educativo e não substitui o diagnóstico clínico realizado por cirurgião-dentista devidamente registrado no CRO.</em></p>
<!-- /wp:paragraph -->`
  },
  {
    title: 'Como o Invisalign Funciona',
    slug: 'como-o-invisalign-funciona',
    content: `<!-- wp:paragraph {"style":{"typography":{"fontSize":"1.125rem","lineHeight":"1.6"}},"textColor":"secondary"} -->
<p class="has-secondary-color has-text-color" style="font-size:1.125rem;line-height:1.6">O sistema Invisalign combina tecnologia de mapeamento tridimensional, biotecnologia patenteada SmartTrack® e planejamento clínico personalizado para transformar seu sorriso com discrição, conforto e previsibilidade.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2,"textColor":"primary"} -->
<h2 class="wp-block-heading has-primary-color has-text-color">As etapas do tratamento</h2>
<!-- /wp:heading -->

<!-- wp:list {"ordered":true} -->
<ol class="wp-block-list">
  <li><strong>Escaneamento Digital 3D (iTero):</strong> Em poucos minutos, capturamos uma imagem digital de alta definição de toda a sua arcada. Sem pastas ou moldes desconfortáveis.</li>
  <li><strong>Simulação ClinCheck®:</strong> Nosso especialista planeja digitalmente cada micromovimento dentário. Você visualiza a progressão projetada do seu sorriso antes mesmo de iniciar.</li>
  <li><strong>Fabricação dos Alinhadores Personalizados:</strong> Uma série sob medida de alinhadores transparentes é confeccionada em material SmartTrack®, aplicando forças suaves e contínuas.</li>
  <li><strong>Uso no dia a dia:</strong> Você utiliza cada jogo de alinhadores de 20 a 22 horas diárias, retirando apenas para refeições e higienização. A cada 7 a 14 dias, troca-se pelo par seguinte.</li>
  <li><strong>Consultas de acompanhamento:</strong> Visitas presenciais na Prime Odontologia em Belo Horizonte para certificar o avanço seguro de cada fase.</li>
  <li><strong>Contenção Definitiva Vivera®:</strong> Ao finalizar, alinhadores de contenção preservam os resultados conquistados.</li>
</ol>
<!-- /wp:list -->

<!-- wp:heading {"level":2,"textColor":"primary"} -->
<h2 class="wp-block-heading has-primary-color has-text-color">Por que escolher os alinhadores transparentes?</h2>
<!-- /wp:heading -->

<!-- wp:columns {"style":{"spacing":{"blockGap":{"top":"1.5rem","left":"2rem"}}}} -->
<div class="wp-block-columns">
  <!-- wp:column {"style":{"spacing":{"padding":{"top":"1.5rem","bottom":"1.5rem","left":"1.5rem","right":"1.5rem"}},"border":{"radius":"6px","width":"1px","color":"var(--wp--preset--color--line)"}},"backgroundColor":"surface"} -->
  <div class="wp-block-column has-surface-background-color has-background" style="border-color:var(--wp--preset--color--line);border-width:1px;border-radius:6px;padding:1.5rem">
    <!-- wp:heading {"level":3,"style":{"typography":{"fontSize":"1.125rem","fontWeight":"700"}},"textColor":"primary"} -->
    <h3 class="wp-block-heading has-primary-color has-text-color" style="font-size:1.125rem;font-weight:700">Discrição Absoluta</h3>
    <!-- /wp:heading -->
    <!-- wp:paragraph {"style":{"typography":{"fontSize":"0.9375rem"}},"textColor":"secondary"} -->
    <p class="has-secondary-color has-text-color" style="font-size:0.9375rem">Praticamente imperceptíveis na rotina social, fotos e reuniões de trabalho.</p>
    <!-- /wp:paragraph -->
  </div>
  <!-- /wp:column -->

  <!-- wp:column {"style":{"spacing":{"padding":{"top":"1.5rem","bottom":"1.5rem","left":"1.5rem","right":"1.5rem"}},"border":{"radius":"6px","width":"1px","color":"var(--wp--preset--color--line)"}},"backgroundColor":"surface"} -->
  <div class="wp-block-column has-surface-background-color has-background" style="border-color:var(--wp--preset--color--line);border-width:1px;border-radius:6px;padding:1.5rem">
    <!-- wp:heading {"level":3,"style":{"typography":{"fontSize":"1.125rem","fontWeight":"700"}},"textColor":"primary"} -->
    <h3 class="wp-block-heading has-primary-color has-text-color" style="font-size:1.125rem;font-weight:700">Conforto e Sem Machucados</h3>
    <!-- /wp:heading -->
    <!-- wp:paragraph {"style":{"typography":{"fontSize":"0.9375rem"}},"textColor":"secondary"} -->
    <p class="has-secondary-color has-text-color" style="font-size:0.9375rem">Bordas recortadas individualmente na linha da gengiva, sem fios ou bráquetes metálicos cortantes.</p>
    <!-- /wp:paragraph -->
  </div>
  <!-- /wp:column -->
</div>
<!-- /wp:columns -->

<!-- wp:buttons {"style":{"spacing":{"margin":{"top":"2rem"}}}} -->
<div class="wp-block-buttons" style="margin-top:2rem">
  <!-- wp:button {"backgroundColor":"primary","textColor":"background","style":{"border":{"radius":"6px"},"typography":{"fontSize":"1rem","fontWeight":"600"}}} -->
  <div class="wp-block-button"><a class="wp-block-button__link has-background-color has-primary-background-color has-text-color has-background-color wp-element-button" href="https://wa.me/5531992893060" target="_blank" rel="noopener noreferrer" style="border-radius:6px;font-size:1rem;font-weight:600">Agendar Consulta no WhatsApp</a></div>
  <!-- /wp:button -->
</div>
<!-- /wp:buttons -->`
  },
  {
    title: 'Conheça a Nossa Equipe',
    slug: 'equipe',
    content: `<!-- wp:paragraph {"style":{"typography":{"fontSize":"1.125rem","lineHeight":"1.6"}},"textColor":"secondary"} -->
<p class="has-secondary-color has-text-color" style="font-size:1.125rem;line-height:1.6">Na Prime Odontologia, nossa equipe de cirurgiões-dentistas atua de forma interdisciplinar, integrando planejamento digital avançado, diagnóstico minucioso e atendimento acolhedor.</p>
<!-- /wp:paragraph -->

<!-- wp:quote {"className":"wp-block-quote"} -->
<blockquote class="wp-block-quote">
  <p>“Acreditamos que a prevenção e o planejamento integrado são o alicerce fundamental para a longevidade de um sorriso saudável e para o bem-estar duradouro dos nossos pacientes.”</p>
  <cite>Dr. André Almeida — Prime Odontologia</cite>
</blockquote>
<!-- /wp:quote -->

<!-- wp:heading {"level":2,"textColor":"primary"} -->
<h2 class="wp-block-heading has-primary-color has-text-color">Nossa Filosofia de Cuidado</h2>
<!-- /wp:heading -->

<!-- wp:list -->
<ul class="wp-block-list">
  <li><strong>Atendimento Humanizado:</strong> Escuta atenta para compreender sua história bucal, expectativas e rotina.</li>
  <li><strong>Planejamento Integrado:</strong> Especialistas em ortodontia digital, estética, periodontia e reabilitação que discutem conjuntamente os casos complexos.</li>
  <li><strong>Tecnologia Diagnóstica:</strong> Escaneamento intraoral 3D, radiografia digital e simulação dinâmica para maior previsibilidade e segurança clínica.</li>
  <li><strong>Estrutura Completa:</strong> Consultórios equipados no bairro Lourdes em Belo Horizonte, com ambiente calmo e estacionamento privativo gratuito.</li>
</ul>
<!-- /wp:list -->

<!-- wp:heading {"level":2,"textColor":"primary"} -->
<h2 class="wp-block-heading has-primary-color has-text-color">Visite nossa clínica</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"textColor":"secondary"} -->
<p class="has-secondary-color has-text-color">Estamos localizados em ponto central e de fácil acesso no bairro Lourdes, em frente ao Conexão Internacional. Estacionamento privativo no local para maior comodidade.</p>
<!-- /wp:paragraph -->

<!-- wp:buttons {"style":{"spacing":{"margin":{"top":"2rem"}}}} -->
<div class="wp-block-buttons" style="margin-top:2rem">
  <!-- wp:button {"backgroundColor":"primary","textColor":"background","style":{"border":{"radius":"6px"},"typography":{"fontSize":"1rem","fontWeight":"600"}}} -->
  <div class="wp-block-button"><a class="wp-block-button__link has-background-color has-primary-background-color has-text-color has-background-color wp-element-button" href="https://wa.me/5531992893060" target="_blank" rel="noopener noreferrer" style="border-radius:6px;font-size:1rem;font-weight:600">Falar com a Equipe</a></div>
  <!-- /wp:button -->
</div>
<!-- /wp:buttons -->`
  },
  {
    title: 'Dúvidas Frequentes sobre Invisalign',
    slug: 'perguntas-sobre-o-invisalign',
    content: `<!-- wp:paragraph {"style":{"typography":{"fontSize":"1.125rem","lineHeight":"1.6"}},"textColor":"secondary"} -->
<p class="has-secondary-color has-text-color" style="font-size:1.125rem;line-height:1.6">Reunimos as respostas para as principais dúvidas de quem deseja transformar o sorriso com alinhadores transparentes na Prime Odontologia em Belo Horizonte.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":3,"textColor":"primary"} -->
<h3 class="wp-block-heading has-primary-color has-text-color">1. Quanto custa o tratamento Invisalign?</h3>
<!-- /wp:heading -->
<!-- wp:paragraph {"textColor":"secondary"} -->
<p class="has-secondary-color has-text-color">O investimento varia de acordo com a complexidade de cada paciente e a quantidade de alinhadores necessários. Existem modalidades mais rápidas (como o Invisalign Express ou Lite para pequenas correções) e tratamentos abrangentes (Invisalign Comprehensive). O valor e as condições de pagamento são detalhados após a avaliação clínica presencial e escaneamento 3D.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":3,"textColor":"primary"} -->
<h3 class="wp-block-heading has-primary-color has-text-color">2. As pessoas vão notar que estou usando o aparelho?</h3>
<!-- /wp:heading -->
<!-- wp:paragraph {"textColor":"secondary"} -->
<p class="has-secondary-color has-text-color">Os alinhadores são feitos com o material SmartTrack®, ultrafino e transparente. A uma distância social normal de conversa, eles passam praticamente despercebidos.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":3,"textColor":"primary"} -->
<h3 class="wp-block-heading has-primary-color has-text-color">3. Quantas horas por dia devo usar os alinhadores?</h3>
<!-- /wp:heading -->
<!-- wp:paragraph {"textColor":"secondary"} -->
<p class="has-secondary-color has-text-color">A recomendação para assegurar a movimentação planejada é de 20 a 22 horas por dia, retirando apenas para comer, beber líquidos quentes/coloridos e escovar os dentes.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":3,"textColor":"primary"} -->
<h3 class="wp-block-heading has-primary-color has-text-color">4. O tratamento causa dor?</h3>
<!-- /wp:heading -->
<!-- wp:paragraph {"textColor":"secondary"} -->
<p class="has-secondary-color has-text-color">Nos primeiros dias de cada novo alinhador, é comum sentir uma leve pressão nos dentes, indicando que a movimentação foi ativada. Não há o desconforto constante de ferimentos na bochecha provocados por metais pontiagudos.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":3,"textColor":"primary"} -->
<h3 class="wp-block-heading has-primary-color has-text-color">5. Posso praticar esportes?</h3>
<!-- /wp:heading -->
<!-- wp:paragraph {"textColor":"secondary"} -->
<p class="has-secondary-color has-text-color">Sim! Sem partes metálicas pontiagudas, os alinhadores são extremamente seguros para a prática esportiva, sem risco de cortes internos nos lábios em caso de impacto leve.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":3,"textColor":"primary"} -->
<h3 class="wp-block-heading has-primary-color has-text-color">6. Como faço para higienizar os alinhadores?</h3>
<!-- /wp:heading -->
<!-- wp:paragraph {"textColor":"secondary"} -->
<p class="has-secondary-color has-text-color">Basta escová-los suavemente com água em temperatura ambiente e sabonete neutro ou cristais de limpeza recomendados, antes de recolocá-los após as refeições.</p>
<!-- /wp:paragraph -->

<!-- wp:buttons {"style":{"spacing":{"margin":{"top":"2rem"}}}} -->
<div class="wp-block-buttons" style="margin-top:2rem">
  <!-- wp:button {"backgroundColor":"accent","textColor":"background","style":{"border":{"radius":"6px"},"typography":{"fontSize":"1rem","fontWeight":"600"}}} -->
  <div class="wp-block-button"><a class="wp-block-button__link has-background-color has-accent-background-color has-text-color has-background-color wp-element-button" href="https://wa.me/5531992893060" target="_blank" rel="noopener noreferrer" style="border-radius:6px;font-size:1rem;font-weight:600">Tirar outras dúvidas no WhatsApp</a></div>
  <!-- /wp:button -->
</div>
<!-- /wp:buttons -->`
  },
  {
    title: 'Política de Privacidade',
    slug: 'politica-de-privacidade',
    content: `<!-- wp:paragraph {"style":{"typography":{"fontSize":"0.9375rem","lineHeight":"1.6"}},"textColor":"secondary"} -->
<p class="has-secondary-color has-text-color" style="font-size:0.9375rem;line-height:1.6">A Prime Odontologia respeita a sua privacidade e cumpre rigorosamente as normas da Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018) e o sigilo profissional odontológico regulado pelo Conselho Federal de Odontologia (CFO).</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2,"textColor":"primary"} -->
<h2 class="wp-block-heading has-primary-color has-text-color">1. Informações Coletadas</h2>
<!-- /wp:heading -->
<!-- wp:paragraph {"textColor":"secondary"} -->
<p class="has-secondary-color has-text-color">Ao entrar em contato pelo nosso site ou canais de atendimento (como WhatsApp e formulários), coletamos apenas as informações voluntariamente fornecidas para agendamento de consultas e esclarecimento de dúvidas clínicas: nome completo, telefone e e-mail.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2,"textColor":"primary"} -->
<h2 class="wp-block-heading has-primary-color has-text-color">2. Finalidade do Tratamento</h2>
<!-- /wp:heading -->
<!-- wp:paragraph {"textColor":"secondary"} -->
<p class="has-secondary-color has-text-color">Os dados recebidos são utilizados exclusivamente para confirmação de agendamentos, comunicação entre o paciente e a equipe clínica e envio de orientações sobre tratamentos em andamento. Não comercializamos nem compartilhamos seus dados com terceiros para fins publicitários.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2,"textColor":"primary"} -->
<h2 class="wp-block-heading has-primary-color has-text-color">3. Seus Direitos</h2>
<!-- /wp:heading -->
<!-- wp:paragraph {"textColor":"secondary"} -->
<p class="has-secondary-color has-text-color">Você pode, a qualquer momento, solicitar a confirmação, correção ou exclusão dos seus dados cadastrais de contato através dos nossos canais oficiais de comunicação.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph {"style":{"typography":{"fontSize":"0.8125rem"}},"textColor":"secondary"} -->
<p class="has-secondary-color has-text-color" style="font-size:0.8125rem">Última atualização: Outubro de 2026. Prime Odontologia — Belo Horizonte, MG.</p>
<!-- /wp:paragraph -->`
  }
];

const tempDir = path.join(process.cwd(), 'scratch');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

for (const p of pages) {
  const tmpFile = path.join(tempDir, `${p.slug}.txt`);
  fs.writeFileSync(tmpFile, p.content, 'utf8');
  
  // Check if page already exists
  const existing = runWp(`post list --post_type=page --name="${p.slug}" --field=ID --format=csv`).trim();
  if (existing) {
    console.log(`Updating existing page '${p.slug}' (ID: ${existing})...`);
    runWp(`post update ${existing} --post_title="${p.title}" "${tmpFile}"`);
  } else {
    console.log(`Creating page '${p.title}' (${p.slug})...`);
    runWp(`post create --post_type=page --post_status=publish --post_title="${p.title}" --post_name="${p.slug}" "${tmpFile}"`);
  }
}

// Clean up temp
fs.rmSync(tempDir, { recursive: true, force: true });
console.log('All core pages setup successfully!');
