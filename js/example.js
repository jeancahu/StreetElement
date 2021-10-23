import { streetElementGroup } from "../lib/streetelement.js";

// Create a new StreetElementGroup
console.log("Create the object");
let SEGroup = new streetElementGroup({
  center: [-84.097479, 9.865698],
});

SEGroup.setZoom(17.6); // FIXME

console.log("Set target");
SEGroup.setTarget(document.getElementById("map_container"));

// Add a single node
let start_node = SEGroup.addNode({
  // TODO
  coordinate: [-84.097973, 9.86529],
  type: "endpoint",
});

console.log(start_node);

// Add a second node (auto linked)
let fork_node = SEGroup.addNode({
  coordinate: [-84.097719, 9.8653686],
  type: "waypoint",
  //    type: "fork",
});

// SEGroup.addNode({
//   coordinate: [-84.097665, 9.8653129],
//   type: "endpoint",
// });

// SEGroup.selectNodeByID(fork_node.getID()); // FIXME

// Add a set of nodes (auto linked)
let waypoints_list = [
  [-84.097574, 9.8654472],
  [-84.097521, 9.865552],
  [-84.097479, 9.865698],
  [-84.097369, 9.8658552],
  [-84.097259, 9.8659487],
].map((input_coor) =>
  SEGroup.addNode({
    coordinate: input_coor,
    type: "waypoint",
  })
);

// Add an endpoint
let end_node = SEGroup.addNode({
  // TODO
  coordinate: [-84.097001, 9.8661171],
  type: "endpoint",
});

console.log(end_node);

SEGroup.unselectNode(); // FIXME

// Create a Shape object inside the StreetElementGroup
let shape = SEGroup.addShape({
  id: "new_shape",
  start: start_node,
  end: end_node,
  waypoints: waypoints_list,
});

// Set the shape visible
shape.setVisible(true);

// Convert Shape data to GTFS format
// display it in console
(function () {
  console.log(
    SEGroup.shapesToGTFS() // FIXME
  );
})();

function downloadShapesTXT() {
  console.log("Download shapes.txt");
  console.log(SEGroup.shapesToGTFS());
  alert(SEGroup.shapesToGTFS());
}

export { SEGroup, downloadShapesTXT, shape };
