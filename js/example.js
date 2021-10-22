import { streetElementGroup } from "../lib/streetelement.js";

// Create a new StreetElementGroup
console.log("Create the object");
let SEGroup = new streetElementGroup({
  center: [-84.097479, 9.865698],
});

SEGroup.getMap().getView().setZoom(17.6); // FIXME

console.log("Set target");
SEGroup.setTarget(document.getElementById("map_container"));

// Add a single node
let start_node_id = SEGroup.addNode({
  // TODO
  coordinate: [-84.097973, 9.86529],
  type: "endpoint",
});

// Add a second node (auto linked)
SEGroup.addNode({
  coordinate: [-84.097719, 9.8653686],
  type: "waypoint",
});

// Add a set of nodes (auto linked)
[
  [-84.097574, 9.8654472],
  [-84.097521, 9.865552],
  [-84.097479, 9.865698],
  [-84.097369, 9.8658552],
  [-84.097259, 9.8659487],
].forEach((input_coor) =>
  SEGroup.addNode({
    coordinate: input_coor,
    type: "waypoint",
  })
);

// Add an endpoint
let end_node_id = SEGroup.addNode({
  // TODO
  coordinate: [-84.097001, 9.8661171],
  type: "endpoint",
});

// Create a Shape object inside the StreetElementGroup
SEGroup.addShape({
  id: "new_shape",
  start: 0, // start_node_id // TODO
  end: 7, // end_node_id // TODO
});

SEGroup.shapes.array[0].setVisible(true); // FIXME

// Convert Shape data to GTFS format
// display it in console
(function () {
    console.log(
        SEGroup.shapesToGTFS() // FIXME
    );
})();

export { SEGroup };
