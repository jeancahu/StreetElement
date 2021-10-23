# StreetElement

[![NPM](https://nodei.co/npm/streetelement.png?downloads=true)](https://www.npmjs.com/package/streetelement)

Frontend package `streetelement` has some JavaScript classes about `GTFS` to use it plotting and editing data on map [OpenLayers](https://www.npmjs.com/package/ol)/OpenStreetMap to visualize data, and it defines some functions to interact with GTFS tables, it makes the edition of these elements easier to contain when those features are part of a [GTFS web-editor](https://github.com/jeancahu/GTFS_shapes_editor_JS).

An example editor site uses OpenLayers styles from node_modules and mounts the map on _map\_container_ div:
```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <title>Example</title>
        <link href="./node_modules/ol/ol.css" rel="stylesheet"/>
        <style>
         /* CSS Comment */
         .map_container {
             width: 70%;
             height: 70vh;
         }
        </style>
    </head>
    <body>
        <div class="main">
            <div id="map_container" class="map_container">
            </div>
            <button onclick="global.downloadShapesTXT()">Console log / Alert: Shapes.txt</button>
        </div>
    </body>
    <footer>
        <script src="./dist/main.bundle.js"></script>
    </footer>
</html>
```

The main object is the streetElementGroup, you could initialize an instance and set some element from your document as its target, constructor will mount the map along the controls in the DOM selected element.

```js
import { streetElementGroup } from "streetelement";

// Create a new StreetElementGroup
let SEGroup = new streetElementGroup({
  center: [-84.097479, 9.865698],
});

// Map initial zoom
SEGroup.setZoom(17.6);

// Set document element as target
SEGroup.setTarget(document.getElementById("map_container"));

// Add a single node
let start_node = SEGroup.addNode({
  coordinate: [-84.097973, 9.86529],
  type: "endpoint",
});

// Add a second node (auto linked)
let fork_node = SEGroup.addNode({
  coordinate: [-84.097719, 9.8653686],
  type: "waypoint",
});

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
  coordinate: [-84.097001, 9.8661171],
  type: "endpoint",
});

// Create a Shape object inside the StreetElementGroup
let shape = SEGroup.addShape({
  id: "new_shape",
  start: start_node,
  end: end_node,
});

// Set the shape visible
shape.setVisible(true);

// Convert Shape data to GTFS format
// display it in console
console.log(
  SEGroup.shapesToGTFS()
);

function downloadShapesTXT() {
  console.log("Display shapes.txt");
  console.log(SEGroup.shapesToGTFS());
  alert(SEGroup.shapesToGTFS());
}

export { SEGroup, downloadShapesTXT};
```
In this _example.js_ we are exporting the object it means we can use the class methods from the browser console (we still need specifying lib name as "global" in webpack configuration).

```json
...
entry: {
    main: {
        import: './js/example.js',
    },
},
output: {
    library: 'global',
    filename: '[name].bundle.js',
    path: (new URL('dist/', import.meta.url)).pathname,
},
...
```

The example page will render the map (just like below) and you could interact with it to draw a shape or place stops, then you can download or manage the data through the class methods.

![image](https://user-images.githubusercontent.com/18200186/138550464-55da24e2-f575-4ee3-90a7-282cbd049c61.png)

In this example we created a method to raise an alert with the shape information when the button bottom is pressed.

![image](https://user-images.githubusercontent.com/18200186/138550473-ebae5e2d-5a9f-4117-886e-cf1e6b893ff9.png)

There is an example the editor integration with a Django app [GTFS web-editor](https://github.com/jeancahu/GTFS_shapes_editor_JS).

![image](https://user-images.githubusercontent.com/18200186/138210135-751bb2ff-0f31-4271-a195-35214df7e4de.png)

You are able to add nodes and draw shapes manually throught the map or calling for streetElementGroup methods.
Every node and link created has an unique ID, you can select the node or delete it by ID, to know a node ID you can select it manually on map, it will raise a popup info with some values related to the node.

Placing nodes with long distance in between will trigger a routing process to get the shorter path to link them, this router machine is a demo service then some times it could have a time to work, otherwise it is possible to draw using short distances, it will link directly with non-routed linear features.

A little and broken (due github blocks external sources) concept example, use it in fullscreen mode.
[Example](https://jeancahu.github.io/streetelement/#)
