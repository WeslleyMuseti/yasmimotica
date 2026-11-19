<?php
/**
 * API DE CONSULTA AO ARQUIVO HISTÓRICO LEGADO - YASMIN ÓTICA
 * Conexão com banco MySQL da Hostinger (u854247320_yasminotica)
 * Suporte a paginação real de 50 em 50 registros, busca rápida e totais consolidados.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Carrega credenciais do arquivo de configuração isolado
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
    // Se o banco MySQL não estiver acessível, tenta fallback para cache JSON local
    $localCache = __DIR__ . '/../data/legado_cache.json';
    if (file_exists($localCache)) {
        $jsonContent = file_get_contents($localCache);
        $data = json_decode($jsonContent, true);
        if ($data) {
            echo json_encode([
                'success' => true,
                'fromCache' => true,
                'totalRegistros' => $data['stats']['total'] ?? 32204,
                'counts' => $data['stats'] ?? []
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    echo json_encode([
        'success' => false,
        'error' => 'Falha na conexão com o banco de dados MySQL: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$action = isset($_GET['action']) ? trim($_GET['action']) : 'search';

$tables = [
    'marketing' => 'tb_marketing_legado',
    'vendas'    => 'tb_vendas_legado',
    'vouchers'  => 'tb_vouchers_legado',
    'parcelas'  => 'tb_parcelas_legado',
    'estoque'   => 'tb_estoque_legado'
];

// ─── 1. VERIFICAÇÃO DE STATUS & ESTATÍSTICAS ─────────────────────────────────
if ($action === 'status') {
    try {
        $counts = [];
        $totalGeral = 0;
        foreach ($tables as $key => $table) {
            try {
                $stmt = $pdo->query("SELECT COUNT(*) AS total FROM `$table`");
                $row = $stmt->fetch();
                $cnt = (int)($row['total'] ?? 0);
            } catch (\Exception $ex) {
                $cnt = 0;
            }
            $counts[$key] = $cnt;
            $totalGeral += $cnt;
        }

        echo json_encode([
            'success' => true,
            'connected' => true,
            'database' => $db,
            'totalRegistros' => $totalGeral,
            'counts' => $counts
        ], JSON_UNESCAPED_UNICODE);
        exit;
    } catch (\Exception $e) {
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// ─── 2. BUSCA NO ARQUIVO HISTÓRICO COM PAGINAÇÃO DE 50 EM 50 ─────────────────
$query = isset($_GET['q']) ? trim($_GET['q']) : '';
$tipo  = isset($_GET['tipo']) ? trim($_GET['tipo']) : 'todas';
$limit = isset($_GET['limit']) ? min(100, max(1, (int)$_GET['limit'])) : 50;
$page  = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
$offset = ($page - 1) * $limit;

// Limpa pontuação para busca de CPF ou Telefone
$numbersOnly = preg_replace('/\D/', '', $query);
$isNumericSearch = strlen($numbersOnly) >= 3;

$results = [
    'marketing' => [],
    'vendas'    => [],
    'vouchers'  => [],
    'parcelas'  => [],
    'estoque'   => []
];

$counts = [
    'marketing' => 0,
    'vendas'    => 0,
    'vouchers'  => 0,
    'parcelas'  => 0,
    'estoque'   => 0
];

try {
    $paramSearch = "%$query%";
    $paramNum    = "%$numbersOnly%";

    // ── 2.1 Marketing & Pós-Venda
    if ($tipo === 'todas' || $tipo === 'marketing') {
        $hasInsta = false;
        try {
            $c = $pdo->query("SHOW COLUMNS FROM `tb_marketing_legado` LIKE 'instagram'");
            $hasInsta = ($c->rowCount() > 0);
        } catch (\Exception $e) {}

        if (empty($query)) {
            $cntStmt = $pdo->query("SELECT COUNT(*) AS total FROM `tb_marketing_legado`");
            $counts['marketing'] = (int)($cntStmt->fetch()['total'] ?? 0);

            $stmt = $pdo->prepare("SELECT * FROM `tb_marketing_legado` ORDER BY `id` ASC LIMIT :limit OFFSET :offset");
            $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
            $stmt->execute();
            $results['marketing'] = $stmt->fetchAll();
        } else {
            $whereMkt = "(`nome_cliente` LIKE :q OR `os` LIKE :q";
            if ($hasInsta) $whereMkt .= " OR `instagram` LIKE :q";
            if ($isNumericSearch) $whereMkt .= " OR `telefone` LIKE :num";
            $whereMkt .= ")";

            $cntStmt = $pdo->prepare("SELECT COUNT(*) AS total FROM `tb_marketing_legado` WHERE $whereMkt");
            $cntStmt->bindValue(':q', $paramSearch);
            if ($isNumericSearch) $cntStmt->bindValue(':num', $paramNum);
            $cntStmt->execute();
            $counts['marketing'] = (int)($cntStmt->fetch()['total'] ?? 0);

            $stmt = $pdo->prepare("SELECT * FROM `tb_marketing_legado` WHERE $whereMkt ORDER BY `id` ASC LIMIT :limit OFFSET :offset");
            $stmt->bindValue(':q', $paramSearch);
            if ($isNumericSearch) $stmt->bindValue(':num', $paramNum);
            $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
            $stmt->execute();
            $results['marketing'] = $stmt->fetchAll();
        }
    }

    // ── 2.2 Vendas Registradas
    if ($tipo === 'todas' || $tipo === 'vendas') {
        if (empty($query)) {
            $cntStmt = $pdo->query("SELECT COUNT(*) AS total FROM `tb_vendas_legado`");
            $counts['vendas'] = (int)($cntStmt->fetch()['total'] ?? 0);

            $stmt = $pdo->prepare("SELECT * FROM `tb_vendas_legado` ORDER BY `id` ASC LIMIT :limit OFFSET :offset");
            $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
            $stmt->execute();
            $results['vendas'] = $stmt->fetchAll();
        } else {
            $whereVendas = "(`cliente` LIKE :q OR `responsavel` LIKE :q OR `os` LIKE :q OR `armacao` LIKE :q OR `lente` LIKE :q";
            if ($isNumericSearch) {
                $whereVendas .= " OR `cpf` LIKE :num OR `rg` LIKE :num OR `telefone_cliente` LIKE :num OR `telefone_responsavel` LIKE :num";
            }
            $whereVendas .= ")";

            $cntStmt = $pdo->prepare("SELECT COUNT(*) AS total FROM `tb_vendas_legado` WHERE $whereVendas");
            $cntStmt->bindValue(':q', $paramSearch);
            if ($isNumericSearch) $cntStmt->bindValue(':num', $paramNum);
            $cntStmt->execute();
            $counts['vendas'] = (int)($cntStmt->fetch()['total'] ?? 0);

            $stmt = $pdo->prepare("SELECT * FROM `tb_vendas_legado` WHERE $whereVendas ORDER BY `id` ASC LIMIT :limit OFFSET :offset");
            $stmt->bindValue(':q', $paramSearch);
            if ($isNumericSearch) $stmt->bindValue(':num', $paramNum);
            $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
            $stmt->execute();
            $results['vendas'] = $stmt->fetchAll();
        }
    }

    // ── 2.3 Vouchers & Campanhas
    if ($tipo === 'todas' || $tipo === 'vouchers') {
        if (empty($query)) {
            $cntStmt = $pdo->query("SELECT COUNT(*) AS total FROM `tb_vouchers_legado`");
            $counts['vouchers'] = (int)($cntStmt->fetch()['total'] ?? 0);

            $stmt = $pdo->prepare("SELECT * FROM `tb_vouchers_legado` ORDER BY `id` ASC LIMIT :limit OFFSET :offset");
            $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
            $stmt->execute();
            $results['vouchers'] = $stmt->fetchAll();
        } else {
            $whereVouch = "(`codigo_voucher` LIKE :q OR `os` LIKE :q OR `instagram` LIKE :q OR `cidade` LIKE :q)";

            $cntStmt = $pdo->prepare("SELECT COUNT(*) AS total FROM `tb_vouchers_legado` WHERE $whereVouch");
            $cntStmt->bindValue(':q', $paramSearch);
            $cntStmt->execute();
            $counts['vouchers'] = (int)($cntStmt->fetch()['total'] ?? 0);

            $stmt = $pdo->prepare("SELECT * FROM `tb_vouchers_legado` WHERE $whereVouch ORDER BY `id` ASC LIMIT :limit OFFSET :offset");
            $stmt->bindValue(':q', $paramSearch);
            $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
            $stmt->execute();
            $results['vouchers'] = $stmt->fetchAll();
        }
    }

    // ── 2.4 Parcelas & Carnês
    if ($tipo === 'todas' || $tipo === 'parcelas') {
        if (empty($query)) {
            $cntStmt = $pdo->query("SELECT COUNT(*) AS total FROM `tb_parcelas_legado`");
            $counts['parcelas'] = (int)($cntStmt->fetch()['total'] ?? 0);

            $stmt = $pdo->prepare("SELECT * FROM `tb_parcelas_legado` ORDER BY `id` ASC LIMIT :limit OFFSET :offset");
            $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
            $stmt->execute();
            $results['parcelas'] = $stmt->fetchAll();
        } else {
            $whereParc = "(`nome_cliente` LIKE :q OR `os` LIKE :q OR `loja` LIKE :q";
            if ($isNumericSearch) $whereParc .= " OR `contato` LIKE :num";
            $whereParc .= ")";

            $cntStmt = $pdo->prepare("SELECT COUNT(*) AS total FROM `tb_parcelas_legado` WHERE $whereParc");
            $cntStmt->bindValue(':q', $paramSearch);
            if ($isNumericSearch) $cntStmt->bindValue(':num', $paramNum);
            $cntStmt->execute();
            $counts['parcelas'] = (int)($cntStmt->fetch()['total'] ?? 0);

            $stmt = $pdo->prepare("SELECT * FROM `tb_parcelas_legado` WHERE $whereParc ORDER BY `id` ASC LIMIT :limit OFFSET :offset");
            $stmt->bindValue(':q', $paramSearch);
            if ($isNumericSearch) $stmt->bindValue(':num', $paramNum);
            $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
            $stmt->execute();
            $results['parcelas'] = $stmt->fetchAll();
        }
    }

    // ── 2.5 Estoque Legado
    if ($tipo === 'todas' || $tipo === 'estoque') {
        if (empty($query)) {
            $cntStmt = $pdo->query("SELECT COUNT(*) AS total FROM `tb_estoque_legado`");
            $counts['estoque'] = (int)($cntStmt->fetch()['total'] ?? 0);

            $stmt = $pdo->prepare("SELECT * FROM `tb_estoque_legado` ORDER BY `id` ASC LIMIT :limit OFFSET :offset");
            $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
            $stmt->execute();
            $results['estoque'] = $stmt->fetchAll();
        } else {
            $whereEst = "(`lente` LIKE :q OR `dioptria` LIKE :q)";

            $cntStmt = $pdo->prepare("SELECT COUNT(*) AS total FROM `tb_estoque_legado` WHERE $whereEst");
            $cntStmt->bindValue(':q', $paramSearch);
            $cntStmt->execute();
            $counts['estoque'] = (int)($cntStmt->fetch()['total'] ?? 0);

            $stmt = $pdo->prepare("SELECT * FROM `tb_estoque_legado` WHERE $whereEst ORDER BY `id` ASC LIMIT :limit OFFSET :offset");
            $stmt->bindValue(':q', $paramSearch);
            $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
            $stmt->execute();
            $results['estoque'] = $stmt->fetchAll();
        }
    }

    $activeTotal = ($tipo === 'todas') ? array_sum($counts) : ($counts[$tipo] ?? 0);
    $totalPages = max(1, (int)ceil($activeTotal / $limit));

    echo json_encode([
        'success'    => true,
        'query'      => $query,
        'tipo'       => $tipo,
        'page'       => $page,
        'limit'      => $limit,
        'total'      => $activeTotal,
        'totalPages' => $totalPages,
        'counts'     => $counts,
        'results'    => $results
    ], JSON_UNESCAPED_UNICODE);
    exit;

} catch (\Exception $e) {
    echo json_encode([
        'success' => false,
        'error'   => 'Erro na consulta: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
