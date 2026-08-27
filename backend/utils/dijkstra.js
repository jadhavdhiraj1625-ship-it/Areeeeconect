// backend/utils/dijkstra.js

/**
 * Road network graph for AgriConnect district hubs (distances in km)
 */
const graph = {
  Thalner: { Chopda: 15, Shirpur: 22, Amalner: 30 },
  Chopda: { Thalner: 15, Yawal: 25, Jalgaon: 40 },
  Shirpur: { Thalner: 22, Sendhwa: 35 },
  Amalner: { Thalner: 30, Jalgaon: 35, Pachora: 40 },
  Yawal: { Chopda: 25, Bhusawal: 32 },
  Jalgaon: { Chopda: 40, Amalner: 35, Bhusawal: 28, Jamner: 30, Pachora: 45 },
  Sendhwa: { Shirpur: 35 },
  Bhusawal: { Yawal: 32, Jalgaon: 28, Jamner: 32 },
  Jamner: { Jalgaon: 30, Bhusawal: 32, Pachora: 38 },
  Pachora: { Jalgaon: 45, Amalner: 40, Jamner: 38 }
};

/**
 * Taluka configurations and capacity limits
 */
const talukas = [
  { name: 'chopda', capacity: 3, node: 'Chopda' },
  { name: 'thalner', capacity: 3, node: 'Thalner' },
  { name: 'shirpur', capacity: 3, node: 'Shirpur' },
  { name: 'jalgaon', capacity: 3, node: 'Jalgaon' },
  { name: 'jamner', capacity: 3, node: 'Jamner' },
  { name: 'pachora', capacity: 3, node: 'Pachora' }
];

/**
 * Map node coordinates for geographic mapping
 */
const nodeCoordinates = {
  Thalner: { lat: 21.0, lng: 75.0 },
  Chopda: { lat: 21.2, lng: 75.5 },
  Shirpur: { lat: 21.5, lng: 75.3 },
  Amalner: { lat: 20.9, lng: 74.8 },
  Yawal: { lat: 21.1, lng: 75.1 },
  Jalgaon: { lat: 21.0, lng: 75.4 },
  Sendhwa: { lat: 21.6, lng: 75.2 },
  Bhusawal: { lat: 20.8, lng: 75.6 },
  Jamner: { lat: 20.8, lng: 75.8 },
  Pachora: { lat: 20.6, lng: 75.3 }
};

/**
 * Standard Dijkstra Shortest-Path Algorithm
 * Calculates shortest driving distances from startNode to all graph nodes
 */
function solveDijkstra(startNode) {
  const normStart = String(startNode || 'Thalner').trim();
  
  // Dynamically register new nodes if not in graph
  const existingNodeKey = Object.keys(graph).find(n => n.toLowerCase() === normStart.toLowerCase());
  if (!existingNodeKey && normStart) {
    const formattedNode = normStart.charAt(0).toUpperCase() + normStart.slice(1);
    graph[formattedNode] = { Jalgaon: 50, Pachora: 45 };
    if (graph.Jalgaon) graph.Jalgaon[formattedNode] = 50;
    if (graph.Pachora) graph.Pachora[formattedNode] = 45;
  }

  const distances = {};
  const prev = {};
  const allNodes = Object.keys(graph);

  for (const node of allNodes) {
    distances[node] = Infinity;
    prev[node] = null;
  }

  // Case-insensitive / normalized node matching
  const matchedNode = allNodes.find(n => n.toLowerCase() === normStart.toLowerCase()) || 'Thalner';
  distances[matchedNode] = 0;

  const pq = new Set(allNodes);

  while (pq.size > 0) {
    const u = [...pq].reduce((a, b) => (distances[a] < distances[b] ? a : b));
    pq.delete(u);

    if (distances[u] === Infinity) break;

    for (const [v, weight] of Object.entries(graph[u] || {})) {
      const alt = distances[u] + weight;
      if (alt < distances[v]) {
        distances[v] = alt;
        prev[v] = u;
      }
    }
  }

  return { distances, prev };
}

/**
 * Find the nearest available surveyor based on Dijkstra shortest path
 */
function findNearestAvailableSurveyor(targetNode, availableSurveyors) {
  if (!availableSurveyors || availableSurveyors.length === 0) {
    return { surveyor: null, distance: 0 };
  }

  const cleanTarget = String(targetNode || '').toLowerCase().trim();

  // If there are available surveyors in the exact same taluka, prioritize them with local distance
  const localSurveyors = availableSurveyors.filter(s =>
    (s.taluka && s.taluka.toLowerCase().trim() === cleanTarget) ||
    (s.baseStation && s.baseStation.toLowerCase().trim() === cleanTarget)
  );

  if (localSurveyors.length > 0) {
    localSurveyors.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return {
      surveyor: localSurveyors[0],
      distance: 8 // Local intra-taluka distance (km)
    };
  }

  const { distances } = solveDijkstra(targetNode);
  let nearest = null;
  let minDistance = Infinity;

  for (const s of availableSurveyors) {
    const sNode = s.baseStation || s.taluka || 'Thalner';
    const matchedNode = Object.keys(graph).find(n => n.toLowerCase() === String(sNode).toLowerCase()) || 'Thalner';
    const d = distances[matchedNode] !== undefined ? distances[matchedNode] : 999;

    if (d < minDistance) {
      minDistance = d;
      nearest = s;
    }
  }

  return {
    surveyor: nearest || availableSurveyors[0],
    distance: minDistance !== Infinity ? minDistance : 15
  };
}

/**
 * Authoritative Backend Booking Cost Calculation
 * 1–3 acres: ₹1000/acre
 * 4–8 acres: ₹800/acre
 * >8 acres: ₹600/acre
 */
function calculateBookingCost(acreage) {
  const a = Number(acreage);
  if (!a || a <= 0) return 0;
  if (a <= 3) return Math.ceil(a * 1000);
  if (a <= 8) return Math.ceil(a * 800);
  return Math.ceil(a * 600);
}

module.exports = {
  graph,
  talukas,
  nodeCoordinates,
  solveDijkstra,
  findNearestAvailableSurveyor,
  calculateBookingCost
};
