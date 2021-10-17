import {streetElementGroup} from "../lib/streetelement.js";

// Create a new StreetElementGroup
console.log("Create the object");
let o_se_group = new streetElementGroup();

console.log("Set target");
o_se_group.setTarget(document.getElementById("map_container"));

export { o_se_group };
