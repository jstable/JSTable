<?php

/**
 * Parameters
 */
$startGET = filter_input(INPUT_GET, "start", FILTER_SANITIZE_NUMBER_INT);
$start = $startGET ? intval($startGET) : 0;

$lengthGET = filter_input(INPUT_GET, "length", FILTER_SANITIZE_NUMBER_INT);
$length = $lengthGET ? intval($lengthGET) : 10;

$searchQuery = filter_input(INPUT_GET, "searchQuery", FILTER_SANITIZE_STRING);
$search = empty($searchQuery) || $searchQuery === "null" ? "" : $searchQuery;


$sortColumnIndex = filter_input(INPUT_GET, "sortColumn", FILTER_SANITIZE_NUMBER_INT);
$sortDirection = filter_input(INPUT_GET, "sortDirection", FILTER_SANITIZE_STRING);


/**
 * Raw Data
 */
$data = json_decode(file_get_contents('data.json'));

/**
 * Search
 */
$filtered = $data;
if ($search) {
    $filtered = array_filter($data, function($row) use ($search) {
        foreach ($row as $el) {
            if (preg_match("/$search/i", $el) > 0) {
                return true;
            }
        }
    });
}

/*
 * Sort
 */
if (!is_null($sortColumnIndex) && $sortColumnIndex !== FALSE && $sortColumnIndex !== "null") {
    array_multisort(array_column($filtered, $sortColumnIndex), ($sortDirection === "asc" ? SORT_ASC : SORT_DESC), $filtered);
}


/**
 * Slice
 */
$response = array_slice($filtered, $start, $length);

echo json_encode([
    "recordsTotal" => count($data),
    "recordsFiltered" => count($filtered),
    "data" => $response
]);
