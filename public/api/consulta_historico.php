<?php
/**
 * API DE CONSULTA AO ARQUIVO HISTÓRICO LEGADO - YASMIN ÓTICA
 * Conexão com banco MySQL da Hostinger (u854247320_yasminotica)
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
    echo json_encode([
        'success' => false,
        'error' => 'Falha na conexão com o banco de dados MySQL: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$action = isset($_GET['action']) ? trim($_GET['action']) : 'search';

// ─── 1. VERIFICAÇÃO DE STATUS & ESTATÍSTICAS ─────────────────────────────────
if ($action === 'status') {
    try {
        $counts = [];
        $tables = [
            'vendas' => 'tb_vendas_legado',
            'parcelas' => 'tb_parcelas_legado',
            'vouchers' => 'tb_vouchers_legado',
            'estoque' => 'tb_estoque_legado',
            'marketing' => 'tb_marketing_legado'
        ];
        
        $totalGeral = 0;
        foreach ($tables as $key => $table) {
            $stmt = $pdo->query("SELECT COUNT(*) AS total FROM `$table`");
            $row = $stmt->fetch();
            $cnt = (int)($row['total'] ?? 0);
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

// ─── 2. BUSCA NO ARQUIVO HISTÓRICO ──────────────────────────────────────────
$query = isset($_GET['q']) ? trim($_GET['q']) : '';
$tipo = isset($_GET['tipo']) ? trim($_GET['tipo']) : 'todas';
$limit = isset($_GET['limit']) ? min(100, max(1, (int)$_GET['limit'])) : 50;

if (empty($query)) {
    echo json_encode([
        'success' => true,
        'results' => [
            'vendas' => [],
            'parcelas' => [],
            'vouchers' => [],
            'estoque' => [],
            'marketing' => []
        ],
        'total' => 0,
        'message' => 'Digite um termo para pesquisar no arquivo histórico (Nome, CPF, OS, Telefone).'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Limpa pontuação para busca de CPF ou Telefone
$numbersOnly = preg_replace('/\D/', '', $query);
$isNumericSearch = strlen($numbersOnly) >= 3;

$results = [
    'vendas' => [],
    'parcelas' => [],
    'vouchers' => [],
    'estoque' => [],
    'marketing' => []
];
$totalFound = 0;

try {
    $paramSearch = "%$query%";
    $paramNum = "%$numbersOnly%";

    // 1. Busca em Vendas
    if ($tipo === 'todas' || $tipo === 'vendas') {
        $sqlVendas = "SELECT * FROM `tb_vendas_legado` WHERE 
            `cliente` LIKE :q 
            OR `responsavel` LIKE :q 
            OR `os` LIKE :q 
            OR `armacao` LIKE :q 
            OR `lente` LIKE :q";
        
        if ($isNumericSearch) {
            $sqlVendas .= " OR `cpf` LIKE :num OR `rg` LIKE :num OR `telefone_cliente` LIKE :num OR `telefone_responsavel` LIKE :num";
        }
        $sqlVendas .= " ORDER BY `id` DESC LIMIT $limit";

        $stmt = $pdo->prepare($sqlVendas);
        $stmt->bindValue(':q', $paramSearch);
        if ($isNumericSearch) {
            $stmt->bindValue(':num', $paramNum);
        }
        $stmt->execute();
        $results['vendas'] = $stmt->fetchAll();
        $totalFound += count($results['vendas']);
    }

    // 2. Busca em Parcelas / Carnês
    if ($tipo === 'todas' || $tipo === 'parcelas') {
        $sqlParc = "SELECT * FROM `tb_parcelas_legado` WHERE 
            `nome_cliente` LIKE :q 
            OR `os` LIKE :q 
            OR `loja` LIKE :q";
        
        if ($isNumericSearch) {
            $sqlParc .= " OR `contato` LIKE :num";
        }
        $sqlParc .= " ORDER BY `id` DESC LIMIT $limit";

        $stmt = $pdo->prepare($sqlParc);
        $stmt->bindValue(':q', $paramSearch);
        if ($isNumericSearch) {
            $stmt->bindValue(':num', $paramNum);
        }
        $stmt->execute();
        $results['parcelas'] = $stmt->fetchAll();
        $totalFound += count($results['parcelas']);
    }

    // 3. Busca em Vouchers
    if ($tipo === 'todas' || $tipo === 'vouchers') {
        $sqlVouch = "SELECT * FROM `tb_vouchers_legado` WHERE 
            `codigo_voucher` LIKE :q 
            OR `os` LIKE :q 
            OR `instagram` LIKE :q 
            ORDER BY `id` DESC LIMIT $limit";

        $stmt = $pdo->prepare($sqlVouch);
        $stmt->bindValue(':q', $paramSearch);
        $stmt->execute();
        $results['vouchers'] = $stmt->fetchAll();
        $totalFound += count($results['vouchers']);
    }

    // 4. Busca em Estoque
    if ($tipo === 'todas' || $tipo === 'estoque') {
        $sqlEst = "SELECT * FROM `tb_estoque_legado` WHERE 
            `lente` LIKE :q 
            OR `dioptria` LIKE :q 
            ORDER BY `id` DESC LIMIT $limit";

        $stmt = $pdo->prepare($sqlEst);
        $stmt->bindValue(':q', $paramSearch);
        $stmt->execute();
        $results['estoque'] = $stmt->fetchAll();
        $totalFound += count($results['estoque']);
    }

    // 5. Busca em Marketing & Pós-Vendas
    if ($tipo === 'todas' || $tipo === 'marketing') {
        $sqlMkt = "SELECT * FROM `tb_marketing_legado` WHERE 
            `nome_cliente` LIKE :q 
            OR `os` LIKE :q";
        
        if ($isNumericSearch) {
            $sqlMkt .= " OR `telefone` LIKE :num";
        }
        $sqlMkt .= " ORDER BY `id` DESC LIMIT $limit";

        $stmt = $pdo->prepare($sqlMkt);
        $stmt->bindValue(':q', $paramSearch);
        if ($isNumericSearch) {
            $stmt->bindValue(':num', $paramNum);
        }
        $stmt->execute();
        $results['marketing'] = $stmt->fetchAll();
        $totalFound += count($results['marketing']);
    }

    echo json_encode([
        'success' => true,
        'query' => $query,
        'total' => $totalFound,
        'results' => $results
    ], JSON_UNESCAPED_UNICODE);
    exit;

} catch (\Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Erro na consulta: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
