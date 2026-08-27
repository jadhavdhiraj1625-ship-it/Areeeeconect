<?php
// api.php - Comprehensive API handler for AgriConnect
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once 'db.php';

$action = $_GET['action'] ?? '';
$data = json_decode(file_get_contents("php://input"), true) ?? [];

try {
    switch ($action) {
        // --- AUTH ---
        case 'login':
            $mobile = $data['mobile'] ?? '';
            $password = $data['password'] ?? '';
            $role = $data['role'] ?? '';
            
            if ($role === 'Admin') {
                if ($mobile === 'admin' && $password === 'admin') {
                    echo json_encode(["success" => true, "user" => ["name" => "Admin", "role" => "Admin"]]);
                } else {
                    echo json_encode(["success" => false]);
                }
                exit;
            }

            $table = ($role === 'Farmer') ? 'farmers' : (($role === 'Surveyor') ? 'surveyors' : 'candidates');
            
            // Check candidates login by email instead of mobile if role is Applicant
            if ($role === 'Applicant') {
                $email = $data['email'] ?? '';
                $stmt = $pdo->prepare("SELECT * FROM candidates WHERE email = ?");
                $stmt->execute([$email]);
                $user = $stmt->fetch();
                // We didn't add password to candidates in SQL, so we mock it for now
                if ($user) {
                    $user['role'] = 'Applicant';
                    echo json_encode(["success" => true, "user" => $user]);
                } else {
                    echo json_encode(["success" => false]);
                }
                exit;
            }

            $stmt = $pdo->prepare("SELECT * FROM $table WHERE mobile = ?");
            $stmt->execute([$mobile]);
            $user = $stmt->fetch();
            
            if ($user && $user['password'] === $password) {
                unset($user['password']);
                $user['role'] = $role;
                echo json_encode(["success" => true, "user" => $user]);
            } else {
                echo json_encode(["success" => false, "message" => "Invalid credentials."]);
            }
            break;

        // --- GLOBAL FETCH ---

        case 'get_all_state':
            // Fetches all necessary state for Admin and Dijkstra logic
            $farmers = $pdo->query("SELECT * FROM farmers")->fetchAll();
            $surveyors = $pdo->query("SELECT * FROM surveyors")->fetchAll();
            $candidates = $pdo->query("SELECT * FROM candidates")->fetchAll();
            $bookings = $pdo->query("SELECT * FROM bookings ORDER BY created_at DESC")->fetchAll();
            $farms = $pdo->query("SELECT * FROM farms")->fetchAll();

            echo json_encode([
                "success" => true,
                "farmers" => $farmers,
                "surveyors" => $surveyors,
                "candidates" => $candidates,
                "bookings" => $bookings,
                "farms" => $farms
            ]);
            break;

        // --- FARMS ---
        case 'add_farm':
            $stmt = $pdo->prepare("INSERT INTO farms (farmer_mobile, name, location, area, survey_type, cost) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $data['farmerMobile'], $data['name'], $data['location'], 
                $data['area'], $data['surveyType'], $data['cost']
            ]);
            echo json_encode(["success" => true]);
            break;

        // --- BOOKINGS ---
        case 'add_booking':
            $stmt = $pdo->prepare("INSERT INTO bookings (id, farmer_mobile, farmer_name, surveyor_mobile, surveyor_name, farm_name, survey_type, location, area, cost, distance, status, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Assigned', 'Unpaid')");
            $stmt->execute([
                $data['id'],
                $data['farmerMobile'],
                $data['farmerName'],
                $data['surveyorMobile'],
                $data['surveyorName'],
                $data['farmName'],
                $data['surveyType'],
                $data['location'],
                $data['area'],
                $data['cost'],
                $data['distance']
            ]);
            
            $stmt2 = $pdo->prepare("UPDATE surveyors SET status = 'Busy' WHERE mobile = ?");
            $stmt2->execute([$data['surveyorMobile']]);

            echo json_encode(["success" => true]);
            break;

        case 'update_booking':
            $id = $data['id'];
            $status = $data['status'];
            
            if (isset($data['scheduleDate'])) {
                $stmt = $pdo->prepare("UPDATE bookings SET status = ?, schedule_date = ?, schedule_time = ?, instructions = ? WHERE id = ?");
                $stmt->execute([$status, $data['scheduleDate'], $data['scheduleTime'], $data['instructions'], $id]);
            } 
            else if (isset($data['paymentStatus'])) {
                $stmt = $pdo->prepare("UPDATE bookings SET payment_status = ? WHERE id = ?");
                $stmt->execute([$data['paymentStatus'], $id]);
            }
            else if (isset($data['report'])) {
                $stmt = $pdo->prepare("UPDATE bookings SET status = ?, report_lat = ?, report_lng = ?, report_acreage = ?, report_obs = ?, report_map_image = ? WHERE id = ?");
                $stmt->execute([
                    $status, $data['report']['lat'], $data['report']['lng'], 
                    $data['report']['acreage'], $data['report']['observations'], 
                    $data['report']['mapImage'], $id
                ]);
            } 
            else {
                $stmt = $pdo->prepare("UPDATE bookings SET status = ? WHERE id = ?");
                $stmt->execute([$status, $id]);
            }
            echo json_encode(["success" => true]);
            break;

        case 'add_candidate':
            // Expected fields in $data: name, mobile, email, aadhaar, qualification, experience, taluka, license_no, status (optional)
            $stmt = $pdo->prepare("INSERT INTO candidates (id, name, mobile, email, password, aadhaar, qualification, experience, taluka, license_no, status, interview_score, employeeId) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL, NULL)");
            $candidateId = 'cand-' . time();
            $stmt->execute([
                $candidateId,
                $data['name'],
                $data['mobile'],
                $data['email'],
                $data['aadhaar'] ?? null,
                $data['qualification'] ?? null,
                $data['experience'] ?? null,
                $data['taluka'] ?? null,
                $data['license_no'] ?? null,
                $data['status'] ?? 'Submitted'
            ]);
            echo json_encode(["success" => true, "candidateId" => $candidateId]);
            break;

        case 'update_surveyor':
            if(isset($data['status'])) {
                $stmt = $pdo->prepare("UPDATE surveyors SET status = ? WHERE mobile = ?");
                $stmt->execute([$data['status'], $data['mobile']]);
            }
            if(isset($data['incrementJobs'])) {
                $stmt = $pdo->prepare("UPDATE surveyors SET jobs_completed = jobs_completed + 1 WHERE mobile = ?");
                $stmt->execute([$data['mobile']]);
            }
            echo json_encode(["success" => true]);
            break;

        // --- CANDIDATES (ADMIN) ---
        case 'add_surveyor':
            // Expected fields: mobile, emp_id, password, name, taluka, node
            $stmt = $pdo->prepare("INSERT INTO surveyors (mobile, emp_id, password, name, taluka, node, status) VALUES (?, ?, ?, ?, ?, ?, 'Available')");
            $stmt->execute([
                $data['mobile'],
                $data['emp_id'] ?? null,
                $data['password'] ?? null,
                $data['name'],
                $data['taluka'],
                $data['node']
            ]);
            echo json_encode(["success" => true]);
            break;

        case 'update_candidate':
            if(isset($data['status'])) {
                $stmt = $pdo->prepare("UPDATE candidates SET status = ? WHERE id = ?");
                $stmt->execute([$data['status'], $data['id']]);
            }
            if(isset($data['interviewScore'])) {
                $stmt = $pdo->prepare("UPDATE candidates SET interview_score = ? WHERE id = ?");
                $stmt->execute([$data['interviewScore'], $data['id']]);
            }
            echo json_encode(["success" => true]);
            break;

        default:
            echo json_encode(["error" => "Invalid action"]);
    }
} catch (Exception $e) {
    echo json_encode(["error" => $e->getMessage()]);
}
?>
