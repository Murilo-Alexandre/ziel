# Entradas extras do catálogo de ícones (importado por build-icon-catalog.py).
# (nome Phosphor, rótulo em português do Brasil, categoria, sinônimos/termos relacionados)

# Rótulos/sinônimos corrigidos de entradas que já existiam (o primeiro termo é o nome natural).
OVERRIDES = {
    'scissors': ('Tesoura', 'casa', 'cortar corte cabelo cabeleireiro barbeiro barbearia salão unha recortar costura artesanato papel'),
    'motorcycle': ('Moto de trilha', 'veiculos', 'motocross trilha cross enduro motociclismo'),
    'scooter': ('Lambreta / patinete', 'veiculos', 'scooter moto elétrica patinete'),
    'fork-knife': ('Garfo e faca', 'comida', 'talheres refeição almoço jantar comer restaurante'),
    'bowl-food': ('Prato fundo', 'comida', 'tigela refeição comida marmita arroz feijão'),
    'bowl-steam': ('Sopa', 'comida', 'caldo prato quente tigela'),
    'cooking-pot': ('Panela', 'comida', 'cozinhar receita marmita fogão'),
    'knife': ('Faca', 'comida', 'cozinha talher cortar'),
    'pill': ('Remédio', 'saude', 'medicamento comprimido tomar cápsula vitamina suplemento'),
    'syringe': ('Injeção / vacina', 'saude', 'seringa insulina aplicar vacinar'),
    'tooth': ('Dentista', 'saude', 'dente odontologia escovar fio dental'),
}

EXTRA = [
    # saúde
    ('face-mask', 'Máscara', 'saude', 'proteção respiratória covid'), ('asclepius', 'Farmácia', 'saude', 'medicina símbolo remédio'),
    ('needle', 'Agulha', 'saude', 'acupuntura injeção costura'), ('thermometer-cold', 'Frio', 'saude', 'gripe resfriado temperatura'),
    ('wheelchair-motion', 'Cadeirante', 'saude', 'acessibilidade fisioterapia'), ('hand-heart', 'Cuidado', 'saude', 'carinho voluntariado doação'),
    # esportes
    ('racquet', 'Raquete', 'esportes', 'tênis padel beach tennis squash'), ('ping-pong', 'Tênis de mesa', 'esportes', 'pingue-pongue raquete'),
    ('cricket', 'Críquete', 'esportes', 'taco bola'), ('horse', 'Cavalo', 'esportes', 'hipismo equitação montaria'),
    ('goggles', 'Óculos de natação', 'esportes', 'piscina mergulho esqui'), ('person-simple-throw', 'Arremesso', 'esportes', 'lançar handebol baseball'),
    ('football-helmet', 'Futebol americano', 'esportes', 'capacete rugby'), ('baseball-cap', 'Boné', 'esportes', 'beisebol chapéu'),
    ('boules', 'Bocha', 'esportes', 'petanca bolas'), ('stairs', 'Escada', 'fitness', 'subir degraus treino cardio'),
    ('steps', 'Passos', 'fitness', 'caminhada contagem degraus'), ('heartbeat', 'Cardio', 'fitness', 'batimentos frequência aeróbico'),
    # veículos
    ('moped', 'Moto pequena', 'veiculos', 'biz cg 125 ciclomotor motoneta'), ('moped-front', 'Moto (frente)', 'veiculos', 'motoboy entrega'),
    ('bulldozer', 'Escavadeira', 'veiculos', 'obra máquina trator de esteira'), ('tractor', 'Trator', 'veiculos', 'fazenda agricultura campo'),
    ('crane', 'Guindaste', 'veiculos', 'obra construção'), ('fire-truck', 'Caminhão de bombeiros', 'veiculos', 'bombeiro emergência'),
    ('police-car', 'Viatura', 'veiculos', 'polícia segurança'), ('subway', 'Metrô', 'veiculos', 'trem urbano'), ('tram', 'Bonde', 'veiculos', 'vlt'),
    ('tire', 'Pneu', 'veiculos', 'borracharia calibrar roda'), ('headlights', 'Faróis', 'veiculos', 'luz carro'),
    ('garage', 'Garagem', 'veiculos', 'estacionar casa'), ('charging-station', 'Carregador elétrico', 'veiculos', 'carro elétrico recarga'),
    ('road-horizon', 'Estrada', 'veiculos', 'rodovia viagem caminho'), ('traffic-sign', 'Placa de trânsito', 'veiculos', 'cnh habilitação'),
    ('parachute', 'Paraquedas', 'esportes', 'salto radical'), ('drone', 'Drone', 'tech', 'voar filmagem'),
    # alimentação
    ('onigiri', 'Onigiri', 'comida', 'arroz japonês sushi'), ('shrimp', 'Camarão', 'comida', 'frutos do mar'), ('tea-bag', 'Chá', 'comida', 'infusão erva'),
    ('jar', 'Pote', 'comida', 'conserva geleia'), ('brandy', 'Destilado', 'comida', 'bebida alcoólica'), ('champagne', 'Champanhe', 'comida', 'brinde festa'),
    ('pint-glass', 'Copo', 'comida', 'chopp cerveja água'), ('egg-crack', 'Ovo quebrado', 'comida', 'omelete café da manhã'),
    ('call-bell', 'Campainha de balcão', 'comida', 'garçom restaurante serviço'), ('orange', 'Laranja', 'comida', 'fruta suco vitamina c'),
    ('cheers', 'Brinde', 'comida', 'comemorar bar happy hour'),
    # trabalho
    ('cash-register', 'Caixa registradora', 'trabalho', 'loja vendas comércio pdv'), ('warehouse', 'Armazém', 'trabalho', 'estoque depósito logística'),
    ('building-office', 'Escritório', 'trabalho', 'empresa prédio'), ('toolbox', 'Caixa de ferramentas', 'trabalho', 'mecânico manutenção reparo'),
    ('pipe-wrench', 'Chave inglesa', 'trabalho', 'encanador hidráulica'), ('screwdriver', 'Chave de fenda', 'trabalho', 'eletricista conserto'),
    ('gavel', 'Martelo de juiz', 'trabalho', 'advogado justiça tribunal'), ('detective', 'Detetive', 'trabalho', 'investigação'),
    ('signature', 'Assinatura', 'trabalho', 'contrato documento assinar'), ('clipboard', 'Prancheta', 'trabalho', 'checklist formulário'),
    ('chef-hat', 'Chef', 'trabalho', 'cozinheiro gastronomia'), ('shield-check', 'Segurança', 'trabalho', 'proteção vigilante'),
    # estudos
    ('lectern', 'Palestra', 'estudos', 'apresentação aula púlpito'), ('pencil-ruler', 'Desenho técnico', 'estudos', 'arquitetura projeto engenharia'),
    ('eraser', 'Borracha', 'estudos', 'apagar'), ('highlighter', 'Marca-texto', 'estudos', 'grifar revisar'),
    ('scroll', 'Pergaminho', 'estudos', 'história texto'), ('newspaper', 'Jornal', 'estudos', 'notícias leitura'), ('article', 'Artigo', 'estudos', 'texto blog'),
    # viagens
    ('signpost', 'Placa de direção', 'viagens', 'caminho trilha rota'), ('picnic-table', 'Piquenique', 'viagens', 'parque mesa'),
    ('park', 'Parque', 'viagens', 'praça árvore'), ('windmill', 'Moinho', 'viagens', 'campo'), ('lifebuoy', 'Boia', 'viagens', 'salva-vidas praia'),
    ('tipi', 'Cabana', 'viagens', 'camping acampamento'), ('airplane-landing', 'Pouso', 'viagens', 'chegada voo'), ('globe-stand', 'Globo', 'viagens', 'mundo geografia'),
    # finanças
    ('money-wavy', 'Dinheiro', 'financas', 'nota cédula salário'), ('coin', 'Moeda', 'financas', 'troco'), ('chart-donut', 'Gráfico de rosca', 'financas', 'orçamento categorias'),
    ('tip-jar', 'Cofrinho de gorjeta', 'financas', 'poupar guardar'), ('contactless-payment', 'Pagamento por aproximação', 'financas', 'cartão pix'),
    ('cardholder', 'Carteira de cartões', 'financas', 'cartão crédito fatura'), ('seal-percent', 'Desconto', 'financas', 'promoção oferta'),
    # casa
    ('door', 'Porta', 'casa', 'entrada sair'), ('lamp', 'Abajur', 'casa', 'luz leitura'), ('chair', 'Cadeira', 'casa', 'sentar'),
    ('dresser', 'Cômoda', 'casa', 'guarda-roupa organizar roupas'), ('coat-hanger', 'Cabide', 'casa', 'roupas armário'), ('towel', 'Toalha', 'casa', 'banho'),
    ('plug-charging', 'Carregar', 'casa', 'tomada energia celular'), ('solar-panel', 'Energia solar', 'casa', 'painel'),
    ('fire-extinguisher', 'Extintor', 'casa', 'segurança incêndio'), ('rug', 'Tapete', 'casa', 'sala aspirar'), ('spray-bottle', 'Limpeza', 'casa', 'faxina spray desinfetar'),
    ('wall', 'Parede', 'casa', 'reforma obra pintura'), ('thermometer-simple', 'Temperatura', 'casa', 'clima ar condicionado'),
    # lazer
    ('film-reel', 'Cinema', 'lazer', 'filme sessão'), ('vinyl-record', 'Disco de vinil', 'lazer', 'música'), ('disco-ball', 'Balada', 'lazer', 'festa dança'),
    ('joystick', 'Joystick', 'lazer', 'videogame jogar fliperama'), ('lego', 'Blocos de montar', 'lazer', 'lego brinquedo'), ('popcorn', 'Pipoca', 'lazer', 'cinema filme'),
    ('dice-six', 'Dado', 'lazer', 'jogo tabuleiro'), ('poker-chip', 'Ficha', 'lazer', 'jogo cassino poker'), ('yarn', 'Novelo', 'lazer', 'crochê tricô'),
    ('metronome', 'Metrônomo', 'lazer', 'ritmo música ensaio'), ('music-note', 'Nota musical', 'lazer', 'cantar música'),
    # família e pets
    ('rabbit', 'Coelho', 'familia', 'pet'), ('cow', 'Vaca', 'familia', 'gado fazenda leite'), ('bone', 'Osso', 'familia', 'cachorro pet ração'),
    ('baby', 'Bebê', 'familia', 'filho criança nenê'), ('users-four', 'Família', 'familia', 'grupo pessoas'),
    # natureza
    ('acorn', 'Semente', 'natureza', 'bolota carvalho'), ('clover', 'Trevo', 'natureza', 'sorte planta'), ('cloud-sun', 'Tempo nublado', 'natureza', 'clima previsão'),
    ('sun-dim', 'Luz suave', 'natureza', 'amanhecer'), ('moon', 'Lua', 'natureza', 'noite dormir'), ('tornado', 'Tornado', 'natureza', 'tempestade'), ('mountains', 'Montanhas', 'natureza', 'serra trilha'),
    # tecnologia
    ('keyboard', 'Teclado', 'tech', 'digitar computador'), ('mouse', 'Mouse', 'tech', 'computador'), ('webcam', 'Webcam', 'tech', 'reunião vídeo'),
    ('headset', 'Headset', 'tech', 'atendimento suporte call center'), ('usb', 'USB', 'tech', 'pendrive cabo'), ('hard-drive', 'HD externo', 'tech', 'backup armazenamento'),
    ('device-tablet', 'Tablet', 'tech', 'ipad'), ('monitor', 'Monitor', 'tech', 'tela computador'), ('speaker-hifi', 'Caixa de som', 'tech', 'áudio música'),
    ('security-camera', 'Câmera de segurança', 'tech', 'vigilância'), ('virtual-reality', 'Realidade virtual', 'tech', 'vr óculos'),
    # bem-estar
    ('yin-yang', 'Equilíbrio', 'bemestar', 'harmonia zen'), ('smiley-wink', 'Alegria', 'bemestar', 'sorriso humor'), ('lightbulb', 'Ideia', 'bemestar', 'criatividade inspiração'),
    ('feather', 'Leveza', 'bemestar', 'pena calma'), ('checks', 'Tudo feito', 'bemestar', 'checklist concluído'), ('list-heart', 'Lista de gratidão', 'bemestar', 'gratidão favoritos'),
    ('moon-stars', 'Dormir', 'bemestar', 'sono descanso noite'),
]

# Ícones desenhados à mão (grade 256, traço 16 arredondado), para o que a biblioteca não representa bem.
STROKE = 'fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"'
CUSTOM = [
    ('zl:moto', 'Moto', 'veiculos', 'motocicleta motoboy cg biz pop xre pilotar capacete estrada',
     f'<g {STROKE}><circle cx="56" cy="178" r="32"/><circle cx="200" cy="178" r="32"/>'
     '<path d="M56 178 L100 148"/><path d="M200 178 L176 88"/><path d="M158 82 H192"/></g>'
     '<g fill="currentColor" stroke="currentColor" stroke-width="12" stroke-linejoin="round">'
     '<path d="M76 112 H132 L154 92 H182 L174 122 H112 L88 140 Z"/><path d="M104 146 H148 L156 178 H112 Z"/></g>'),
    ('zl:prato', 'Prato', 'comida', 'refeição comida almoço jantar louça pratinho',
     f'<g {STROKE}><circle cx="128" cy="128" r="88"/><circle cx="128" cy="128" r="52"/></g>'),
    ('zl:prato-talheres', 'Prato com talheres', 'comida', 'refeição almoço jantar garfo faca restaurante comer mesa',
     f'<g {STROKE}><circle cx="128" cy="128" r="56"/><circle cx="128" cy="128" r="30"/>'
     '<path d="M32 44 V84 Q32 104 44 104 Q56 104 56 84 V44 M44 104 V212"/>'
     '<path d="M224 212 V44 Q200 70 200 124 H224"/></g>'),
]
