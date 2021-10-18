import { streetElementGroup } from "../lib/streetelement.js";

// Create a new StreetElementGroup
console.log("Create the object");
let o_se_group = new streetElementGroup({
  center: [-84.1027104, 9.865107],
});

console.log("Set target");
o_se_group.setTarget(document.getElementById("map_container"));

// Add a single node
o_se_group.addNode({
  coordinate: [-84.1027104, 9.865107],
  type: "endpoint",
});

// Add a second node (auto linked)
o_se_group.addNode({
  coordinate: [-84.1033104, 9.865107],
  type: "waypoint",
});

// Add a third node (auto linked)
o_se_group.addNode({
  coordinate: [-84.1033104, 9.865607],
  type: "waypoint",
});

export { o_se_group };
