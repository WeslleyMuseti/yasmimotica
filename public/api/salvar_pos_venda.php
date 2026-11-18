<?php
/**
 * API DE LANÇAMENTO DE PÓS-VENDA, MARKETING E VOUCHERS NO MYSQL
 * Yasmin Ótica - Sincronização inteligente com o banco Hostinger (u854247320_yasminotica)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (file_exists(__DIR__ . '/config_db.php')) {
    require_once __DIR__ . '/config_db.php';
}

$host = defined('DB_HOST') ? DB_HOST : (getenv('DB_HOST') ?: 'localhost');
$db   = defined('DB_NAME') ? DB_NAME : (getenv('DB_NAME') ?: 'u854247320_yasminotica');
$user = defined('DB_USER') ? DB_USER : (getenv('DB_USER') ?: 'u854247320_carla');
$pass = defined('DB_PASS') ? DB_PASS : (getenv('DB_PASS') ?: '');
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Falha na conexão com o banco MySQL: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function parse_currency_val($v) {
    if (!$v) return 0;
    $v = str_replace(['R$', ' ', '.'], '', (string)$v);
    $v = str_replace(',', '.', $v);
    return (float)$v;
}

// ─── LEITURA DOS DADOS RECEBIDOS ─────────────────────────────────────────────
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);
if (!is_array($input)) {
    $input = $_POST;
}

$os = trim((string)($input['os'] ?? $input['numeroOS'] ?? $input['VENDA_OS'] ?? $input['osNumber'] ?? ''));
if (empty($os)) {
    echo json_encode([
        'success' => false,
        'error' => 'O número da OS é obrigatório para registrar a venda e o pós-venda.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Limpeza e formatação de campos
$cliente = trim((string)($input['cliente'] ?? $input['nome_cliente'] ?? $input['CLIENTE'] ?? $input['Nome Completo'] ?? ''));
$telefone = trim((string)($input['telefone'] ?? $input['telefone_cliente'] ?? $input['whatsapp'] ?? $input['TELEFONE'] ?? $input['WhatsApp'] ?? ''));
$responsavel = trim((string)($input['responsavel'] ?? $input['RESPONSAVEL'] ?? 'S/RESPONSAVEL'));
$telefone_responsavel = trim((string)($input['telefone_responsavel'] ?? $input['TELEFONE_RESPONSAVEL'] ?? $telefone));

$instagram = trim((string)($input['instagram'] ?? $input['Instagram'] ?? $input['INSTAGRAM'] ?? ''));
$facebook = trim((string)($input['facebook'] ?? $input['Facebook'] ?? ''));
$tiktok = trim((string)($input['tiktok'] ?? $input['TikTok'] ?? ''));

$loja = trim((string)($input['loja'] ?? $input['cidade'] ?? $input['CIDADE'] ?? $input['unidade'] ?? 'CAJATI'));
$vendedora = trim((string)($input['vendedora'] ?? $input['vendedor'] ?? $input['VENDEDOR'] ?? 'CAIXA'));
$medico = trim((string)($input['medico'] ?? $input['MEDICO'] ?? ''));

$data_venda = trim((string)($input['data_venda'] ?? $input['data'] ?? date('d/m/Y')));
$ano = trim((string)($input['ano'] ?? date('Y')));
$mesSiglas = ['', 'JAN.', 'FEV.', 'MAR.', 'ABR.', 'MAI.', 'JUN.', 'JUL.', 'AGO.', 'SET.', 'OUT.', 'NOV.', 'DEZ.'];
$mIndex = (int)date('m');
$mes = trim((string)($input['mes'] ?? (date('m') . ($mesSiglas[$mIndex] ?? ''))));

$lente = trim((string)($input['lente'] ?? $input['LENTE'] ?? ''));
$armacao = trim((string)($input['armacao'] ?? $input['ARMAÇÃO'] ?? ''));
$dioptria = trim((string)($input['dioptria'] ?? $input['DIOPTRIA'] ?? ''));

$valor_armacao = trim((string)($input['valor_armacao'] ?? $input['VALOR_ARMACAO'] ?? ''));
$valor_lente = trim((string)($input['valor_lente'] ?? $input['VALOR_LENTE'] ?? ''));
$valor_produto = trim((string)($input['valor_produto'] ?? $input['valor_total'] ?? $input['VALOR TOTAL'] ?? '0,00'));
$valor_entrada = trim((string)($input['valor_entrada'] ?? $input['VALOR ENTRADA'] ?? '0,00'));
$n_parcelas = trim((string)($input['n_parcelas'] ?? $input['parcelas_qtd'] ?? '1'));

$tipo_compra = trim((string)($input['tipo_compra'] ?? (parse_currency_val($valor_entrada) >= parse_currency_val($valor_produto) ? 'A VISTA' : 'PARCELADO')));

$rg = trim((string)($input['rg'] ?? $input['RG'] ?? ''));
$cpf = trim((string)($input['cpf'] ?? $input['CPF'] ?? ''));
$data_nascimento = trim((string)($input['data_nascimento'] ?? $input['DATA_NASCIMENTO'] ?? ''));
$idade = trim((string)($input['idade'] ?? ''));

$codigo_voucher = trim((string)($input['codigo_voucher'] ?? $input['voucher'] ?? $input['VOUCHER'] ?? ''));
$tipo_pos_venda = trim((string)($input['tipo_pos_venda'] ?? 'Acompanhamento de Adaptação (15 dias)'));
$obs_pos_venda = trim((string)($input['obs_pos_venda'] ?? ''));

// ─── GARANTIR QUE AS COLUNAS DE PÓS-VENDA EXISTEM EM TB_MARKETING_LEGADO ─────
try {
    $colStmt = $pdo->query("SHOW COLUMNS FROM `tb_marketing_legado` LIKE 'instagram'");
    if ($colStmt->rowCount() === 0) {
        $pdo->exec("ALTER TABLE `tb_marketing_legado` ADD COLUMN `instagram` VARCHAR(100) NULL AFTER `telefone`, ADD COLUMN `tipo_pos_venda` VARCHAR(100) NULL AFTER `instagram`, ADD COLUMN `obs_pos_venda` TEXT NULL AFTER `tipo_pos_venda`, ADD COLUMN `data_registro` TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER `obs_pos_venda`");
    }
} catch (\Exception $e) {
    // Se a tabela ou permissão não permitir alteração, continua normalmente
}

$resumoInsercoes = [];

// ─── 1. TABELA DE VENDAS (tb_vendas_legado) ──────────────────────────────────
try {
    $checkVenda = $pdo->prepare("SELECT id FROM `tb_vendas_legado` WHERE os = :os LIMIT 1");
    $checkVenda->execute([':os' => $os]);
    $vendaId = $checkVenda->fetchColumn();

    if ($vendaId) {
        $updVenda = $pdo->prepare("UPDATE `tb_vendas_legado` SET 
            `cliente` = :cliente,
            `telefone_cliente` = :telefone,
            `responsavel` = :responsavel,
            `telefone_responsavel` = :telefone_responsavel,
            `loja` = :loja,
            `vendedora` = :vendedora,
            `data_venda` = :data_venda,
            `lente` = :lente,
            `armacao` = :armacao,
            `dioptria` = :dioptria,
            `medico` = :medico,
            `valor_armacao` = :valor_armacao,
            `valor_lente` = :valor_lente,
            `valor_produto` = :valor_produto,
            `valor_entrada` = :valor_entrada,
            `n_parcelas` = :n_parcelas,
            `tipo_compra` = :tipo_compra,
            `rg` = :rg,
            `cpf` = :cpf,
            `data_nascimento` = :data_nascimento
            WHERE id = :id");
        $updVenda->execute([
            ':cliente' => $cliente,
            ':telefone' => $telefone,
            ':responsavel' => $responsavel,
            ':telefone_responsavel' => $telefone_responsavel,
            ':loja' => $loja,
            ':vendedora' => $vendedora,
            ':data_venda' => $data_venda,
            ':lente' => $lente,
            ':armacao' => $armacao,
            ':dioptria' => $dioptria,
            ':medico' => $medico,
            ':valor_armacao' => $valor_armacao,
            ':valor_lente' => $valor_lente,
            ':valor_produto' => $valor_produto,
            ':valor_entrada' => $valor_entrada,
            ':n_parcelas' => $n_parcelas,
            ':tipo_compra' => $tipo_compra,
            ':rg' => $rg,
            ':cpf' => $cpf,
            ':data_nascimento' => $data_nascimento,
            ':id' => $vendaId
        ]);
        $resumoInsercoes['vendas'] = "Atualizado na tb_vendas_legado (ID #$vendaId)";
    } else {
        $insVenda = $pdo->prepare("INSERT INTO `tb_vendas_legado` (
            `data_venda`, `ano`, `mes`, `loja`, `vendedora`, `os`, `cliente`, `responsavel`,
            `telefone_responsavel`, `telefone_cliente`, `lente`, `armacao`, `dioptria`,
            `medico`, `valor_armacao`, `valor_lente`, `valor_produto`, `valor_entrada`,
            `n_parcelas`, `tipo_compra`, `rg`, `cpf`, `data_nascimento`
        ) VALUES (
            :data_venda, :ano, :mes, :loja, :vendedora, :os, :cliente, :responsavel,
            :telefone_responsavel, :telefone_cliente, :lente, :armacao, :dioptria,
            :medico, :valor_armacao, :valor_lente, :valor_produto, :valor_entrada,
            :n_parcelas, :tipo_compra, :rg, :cpf, :data_nascimento
        )");
        $insVenda->execute([
            ':data_venda' => $data_venda,
            ':ano' => $ano,
            ':mes' => $mes,
            ':loja' => $loja,
            ':vendedora' => $vendedora,
            ':os' => $os,
            ':cliente' => $cliente,
            ':responsavel' => $responsavel,
            ':telefone_responsavel' => $telefone_responsavel,
            ':telefone_cliente' => $telefone,
            ':lente' => $lente,
            ':armacao' => $armacao,
            ':dioptria' => $dioptria,
            ':medico' => $medico,
            ':valor_armacao' => $valor_armacao,
            ':valor_lente' => $valor_lente,
            ':valor_produto' => $valor_produto,
            ':valor_entrada' => $valor_entrada,
            ':n_parcelas' => $n_parcelas,
            ':tipo_compra' => $tipo_compra,
            ':rg' => $rg,
            ':cpf' => $cpf,
            ':data_nascimento' => $data_nascimento
        ]);
        $resumoInsercoes['vendas'] = "Inserido na tb_vendas_legado (ID #" . $pdo->lastInsertId() . ")";
    }
} catch (\Exception $e) {
    $resumoInsercoes['vendas_erro'] = $e->getMessage();
}

// ─── 2. TABELA DE MARKETING & PÓS-VENDA (tb_marketing_legado) ────────────────
try {
    $checkMkt = $pdo->prepare("SELECT id FROM `tb_marketing_legado` WHERE os = :os LIMIT 1");
    $checkMkt->execute([':os' => $os]);
    $mktId = $checkMkt->fetchColumn();

    $hasInsta = false;
    try {
        $c = $pdo->query("SHOW COLUMNS FROM `tb_marketing_legado` LIKE 'instagram'");
        $hasInsta = ($c->rowCount() > 0);
    } catch (\Exception $e) {}

    if ($mktId) {
        if ($hasInsta) {
            $updMkt = $pdo->prepare("UPDATE `tb_marketing_legado` SET 
                `nome_cliente` = :nome,
                `telefone` = :tel,
                `cidade` = :cid,
                `vendedor` = :vend,
                `data_venda` = :dt,
                `medico` = :med,
                `instagram` = :insta,
                `tipo_pos_venda` = :tipo,
                `obs_pos_venda` = :obs
                WHERE id = :id");
            $updMkt->execute([
                ':nome' => $cliente,
                ':tel' => $telefone,
                ':cid' => $loja,
                ':vend' => $vendedora,
                ':dt' => $data_venda,
                ':med' => $medico,
                ':insta' => $instagram,
                ':tipo' => $tipo_pos_venda,
                ':obs' => $obs_pos_venda,
                ':id' => $mktId
            ]);
        } else {
            $updMkt = $pdo->prepare("UPDATE `tb_marketing_legado` SET 
                `nome_cliente` = :nome,
                `telefone` = :tel,
                `cidade` = :cid,
                `vendedor` = :vend,
                `data_venda` = :dt,
                `medico` = :med
                WHERE id = :id");
            $updMkt->execute([
                ':nome' => $cliente,
                ':tel' => $telefone,
                ':cid' => $loja,
                ':vend' => $vendedora,
                ':dt' => $data_venda,
                ':med' => $medico,
                ':id' => $mktId
            ]);
        }
        $resumoInsercoes['marketing'] = "Atualizado na tb_marketing_legado (ID #$mktId)";
    } else {
        if ($hasInsta) {
            $insMkt = $pdo->prepare("INSERT INTO `tb_marketing_legado` (
                `os`, `vendedor`, `data_venda`, `cidade`, `nome_cliente`, `idade`, `medico`, `telefone`, `instagram`, `tipo_pos_venda`, `obs_pos_venda`
            ) VALUES (
                :os, :vend, :dt, :cid, :nome, :idade, :med, :tel, :insta, :tipo, :obs
            )");
            $insMkt->execute([
                ':os' => $os,
                ':vend' => $vendedora,
                ':dt' => $data_venda,
                ':cid' => $loja,
                ':nome' => $cliente,
                ':idade' => $idade,
                ':med' => $medico,
                ':tel' => $telefone,
                ':insta' => $instagram,
                ':tipo' => $tipo_pos_venda,
                ':obs' => $obs_pos_venda
            ]);
        } else {
            $insMkt = $pdo->prepare("INSERT INTO `tb_marketing_legado` (
                `os`, `vendedor`, `data_venda`, `cidade`, `nome_cliente`, `idade`, `medico`, `telefone`
            ) VALUES (
                :os, :vend, :dt, :cid, :nome, :idade, :med, :tel
            )");
            $insMkt->execute([
                ':os' => $os,
                ':vend' => $vendedora,
                ':dt' => $data_venda,
                ':cid' => $loja,
                ':nome' => $cliente,
                ':idade' => $idade,
                ':med' => $medico,
                ':tel' => $telefone
            ]);
        }
        $resumoInsercoes['marketing'] = "Inserido na tb_marketing_legado (ID #" . $pdo->lastInsertId() . ")";
    }
} catch (\Exception $e) {
    $resumoInsercoes['marketing_erro'] = $e->getMessage();
}

// ─── 3. TABELA DE VOUCHERS (tb_vouchers_legado) ──────────────────────────────
if (!empty($codigo_voucher) || !empty($instagram)) {
    try {
        $checkVouch = $pdo->prepare("SELECT id FROM `tb_vouchers_legado` WHERE os = :os LIMIT 1");
        $checkVouch->execute([':os' => $os]);
        $vouchId = $checkVouch->fetchColumn();

        if ($vouchId) {
            $updVouch = $pdo->prepare("UPDATE `tb_vouchers_legado` SET 
                `codigo_voucher` = :cod,
                `instagram` = :insta,
                `cidade` = :cid,
                `data_compra` = :dt
                WHERE id = :id");
            $updVouch->execute([
                ':cod' => $codigo_voucher ?: 'VOUCHER_CLIENTE',
                ':insta' => $instagram,
                ':cid' => $loja,
                ':dt' => $data_venda,
                ':id' => $vouchId
            ]);
            $resumoInsercoes['vouchers'] = "Atualizado na tb_vouchers_legado (ID #$vouchId)";
        } else {
            $insVouch = $pdo->prepare("INSERT INTO `tb_vouchers_legado` (
                `codigo_voucher`, `data`, `mes`, `ano`, `instagram`, `os`, `data_compra`, `cidade`
            ) VALUES (
                :cod, :data, :mes, :ano, :insta, :os, :dt, :cid
            )");
            $insVouch->execute([
                ':cod' => $codigo_voucher ?: 'VOUCHER_CLIENTE',
                ':data' => $data_venda,
                ':mes' => $mes,
                ':ano' => $ano,
                ':insta' => $instagram,
                ':os' => $os,
                ':dt' => $data_venda,
                ':cid' => $loja
            ]);
            $resumoInsercoes['vouchers'] = "Inserido na tb_vouchers_legado (ID #" . $pdo->lastInsertId() . ")";
        }
    } catch (\Exception $e) {
        $resumoInsercoes['vouchers_erro'] = $e->getMessage();
    }
}

echo json_encode([
    'success' => true,
    'message' => 'Informações de Venda, Marketing e Pós-Venda sincronizadas com sucesso no MySQL!',
    'os' => $os,
    'cliente' => $cliente,
    'resumo' => $resumoInsercoes
], JSON_UNESCAPED_UNICODE);
