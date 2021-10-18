# StreetElement

[![NPM](https://nodei.co/npm/streetelement.png?downloads=true)](https://www.npmjs.com/package/streetelement)

Frontend package `streetelement` has some JavaScript classes about `GTFS` to use it plotting and editing data on a map, it uses [OpenLayers](https://www.npmjs.com/package/ol) to visualize data, and define some functions to interact with GTFS tables, it makes the edition of these elements easier to contain when those features are part of a [GTFS web-editor](https://github.com/jeancahu/GTFS_shapes_editor_JS).

An example editor site uses OpenLayers styles from node_modules and mounts the map on _map\_container_ div:
```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <title>Example</title>
        <link href="./node_modules/ol/ol.css" rel="stylesheet"/>
        <style>
         .map_container {
             width: 70%;
             height: 70vh;
         }
        </style>
    </head>
    <body>
        <div id="map_container" class="map_container">
        </div>
    </body>
    <footer>
        <script src="./dist/main.bundle.js">
        </script>
    </footer>
</html>
```

The JavaScript code is the next. The main object is the streetElementGroup, you could initialize an instance and set some element from your document as its target, constructor will mount the map along the controls in the element.

```js
import {streetElementGroup} from "streetelement";

// Create a new StreetElementGroup
let o_se_group = new streetElementGroup({center: [0.0,0.0]});

// Set the element target
o_se_group.setTarget(document.getElementById("map_container"));

export { o_se_group };
```
In this _example.js_ we are exporting the object that means we can use the class methods from the browser console.

The page will render the map (just like below) and you could interact with it to draw a shape or place stops, then you can download or manage the data through the class methods.
![image](https://user-images.githubusercontent.com/18200186/137670912-fc8cdcd3-2896-4037-b1a7-254556f0d99d.png)

A little and broken (due github blocks external sources) concept example, use it in fullscreen mode.
[Example](https://jeancahu.github.io/streetelement/#)
