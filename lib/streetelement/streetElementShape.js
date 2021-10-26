import streetElementNode from "./streetElementNode.js";
import streetElementLink from "./streetElementLink.js";

import Feature from "ol/Feature.js";
import LineString from "ol/geom/LineString.js";
import { toLonLat } from "ol/proj.js";
import { getLength as getGeometryLength } from "ol/sphere.js";

//////////////// GTFS streetElements ///////////////////
////                                                ////
////  This library tries to encapsulate some of the ////
////  most necessary tables and elements required   ////
////  by the General Transit Feed Specification,    ////
////  format
////
////

export default class streetElementShape {
  constructor(params) {
    // Verify data
    if (params.id == undefined) throw Error("No ID provided for a new shape");

    if (isNaN(params.start)) throw Error("Start should be a Node ID");
    if (isNaN(params.end)) throw Error("End should be a Node ID");

    if (params.waypoints instanceof Array) {
    } else params.waypoints = [];

    // params.node_index
    // params.router
    // Private data

    var nodes_in_shape = []; // TODO deprecate

    var start_vector = [];
    var waypoint_vectors = []; // Matrix
    var end_vector = [];

    const forward = new LineString([]);

    const feature_shape = new Feature({
      geometry: forward,
      name: "Shape_" + params.id,
    });

    // Private methods //
    var setShapeLinksListeners = () => {
      let l_segments_in_shape = this.getSegmentsInShape();
      if (l_segments_in_shape.length == 1 && l_segments_in_shape[0].length == 1)
        return;

      l_segments_in_shape.forEach((segment) => {
        let current_segment = segment.slice(1);
        current_segment.forEach((node, index) => {
          try {
            streetElementLink
              .getLinkBetween(segment[index], node)
              .addShape(this);
          } catch (error) {
            // Start and end are outdate, let's update them
            end_vector = []; // Flush end vector
            this.setStart(this.getStart(), false);
            this.setEnd(this.getEnd(), false);
            this.setWaypoints(this.getWaypoints(), false);
            let inner_link = streetElementLink.getLinkBetween(
              segment[index],
              node
            );
            if (inner_link) inner_link.addShape(this);
            else
              throw Error("Link in shape: " + this.shape_id + " was invalid.");

            throw Error(
              "Start and End node in shape: " + this.shape_id + " were outdate."
            );
          }
        });
      });
    };

    var getSegmentsInShapeToCoordinates = () => {
      let l_segments_in_shape = this.getSegmentsInShape();
      return l_segments_in_shape.map((segment) => {
        // Segment one node
        if (segment.length == 1) return [segment[0].getCoordinates()];

        // Segment more than one node
        let current_segment = segment.slice(1);
        let result_segment = current_segment.map((node, index) => {
          let result = [segment[index].getCoordinates()];
          try {
            result = result.concat(
              streetElementLink
                .getLinkBetween(segment[index], node)
                .getCoordinatesBetween(segment[index], node)
            );
          } catch (error) {
            // Start and end are outdate, let's update them
            end_vector = []; // Flush end vector
            this.setStart(this.getStart(), false);
            this.setEnd(this.getEnd(), false);
            this.setWaypoints(this.getWaypoints(), false);
            throw Error(
              "Start and End node in shape: " + this.shape_id + " were outdate."
            );
          }

          return result;
        });
        result_segment = result_segment.flat();
        result_segment.push(current_segment.pop().getCoordinates());
        return result_segment;
      });
    };

    //////////// Privileged //////////////
    this.setStart = (node_id, compute = true) => {
      if (node_id != undefined && !isNaN(node_id)) params.start = node_id;
      else throw Error("Param to set as start is not a node ID");

      // Computes route when node has only one link
      if (params.node_index(node_id).getConnections().length == 1) {
        start_vector = this.constructor.routeSegment(
          params.node_index(node_id), // Node
          params.node_index(node_id).getConnections()[0] // Link
        );
      } else {
        // Try to find segment to end
        let segment_to_end_node = [];
        if (end_vector.length)
          segment_to_end_node = params
            .node_index(node_id)
            .getConnections()
            .map((connection) => {
              return this.constructor.routeSegment(
                params.node_index(node_id), // Node
                connection
              );
            })
            .filter(
              (segments) =>
                end_vector[end_vector.length - 1].getID() ==
                segments[segments.length - 1].getID()
            );

        if (segment_to_end_node.length) {
          start_vector = segment_to_end_node[0];
        }
        // If it does not find the end point it use a single point vector
        else start_vector = [params.node_index(node_id)]; // Only one node
      }

      if (end_vector.length && compute) {
        this.computeShape();
      }
    };

    this.setEnd = (node_id, compute = true) => {
      if (node_id != undefined && !isNaN(node_id)) params.end = node_id;
      else throw Error("Param to set as end is not a node ID");

      if (params.node_index(node_id).getConnections().length == 1) {
        end_vector = this.constructor
          .routeSegment(
            params.node_index(node_id), // Node
            params.node_index(node_id).getConnections()[0] // Link
          )
          .reverse(); // reverse because it's the end
      } else {
        // Try to find connection to start
        let segment_to_start_node = [];
        if (start_vector.length)
          segment_to_start_node = params
            .node_index(node_id)
            .getConnections()
            .map((connection) => {
              return this.constructor
                .routeSegment(
                  params.node_index(node_id), // Node
                  connection
                )
                .reverse(); // reverse because it's the end
            })
            .filter(
              (segments) => start_vector[0].getID() == segments[0].getID()
            );

        if (segment_to_start_node.length) {
          end_vector = segment_to_start_node[0];
        }
        // If it does not find the start point it use a single point vector
        else end_vector = [params.node_index(node_id)]; // Only one node
      }

      if (start_vector.length && compute) {
        this.computeShape();
      }
    };

    this.getStart = () => {
      return params.start;
    };

    this.getEnd = () => {
      return params.end;
    };

    this.setVisible = (bool_visible) => {
      if (bool_visible) {
        if (params.layer.getSource().getFeatureByUid(feature_shape.ol_uid)) {
        } else params.layer.getSource().addFeature(feature_shape);
      } else {
        if (params.layer.getSource().getFeatureByUid(feature_shape.ol_uid))
          params.layer.getSource().removeFeature(feature_shape);
      }
    };

    this.getSegmentsInShape = () => {
      var nodes = new Array(0);

      // Special case end and start nodes are the same node
      if (end_vector.slice().pop() === start_vector.slice().shift())
        return [[end_vector[0]]];

      // start segment []
      if (start_vector.length) nodes.push(start_vector);
      else throw Error("No start defined in shape " + params.id);

      // middle segments [[], [], ... , []]
      if (waypoint_vectors.length) nodes = nodes.concat(waypoint_vectors); // TODO

      // End segment []
      if (end_vector.length) nodes.push(end_vector);
      else throw Error("No end defined in shape " + params.id);

      // Special case only one valid segment: Start and end are the same segment:
      if (
        JSON.stringify(end_vector.map((l_node) => l_node.getID())) ===
        JSON.stringify(start_vector.map((l_node) => l_node.getID()))
      ) {
        return [start_vector];
      }

      // n1, n2, n3, n4 are Numbers
      return nodes; // [[n1, n2], [n3, n4], [], [], []]
    };

    this.updateShape = (i_params) => {
      end_vector = []; // Flush end vector
      this.setStart(i_params.start, false);
      this.setEnd(i_params.end, false);
      this.setWaypoints(i_params.waypoints);
      params.id = i_params.id; // Update ID
    };

    this.getWaypoints = () => {
      return params.waypoints;
    };

    this.setWaypoints = (waypoints_list, compute = true) => {
      params.waypoints = []; // flush
      waypoint_vectors = []; // flush

      waypoints_list.forEach((waypoint) => {
        this.concatWaypoint(waypoint);
      });

      // Update the whole shape
      if (compute) this.computeShape();
    };

    this.concatWaypoint = (waypoint_id) => {
      if (isNaN(waypoint_id)) throw Error("Parameter is not a Node ID");

      if (
        this.getSegmentsInShape()
          .flat()
          .some((node) => node.getID() === waypoint_id)
      ) {
        // The waypoint is already in some of the shapes segments
        return 0; // ignore the waypoint
      }

      if (params.node_index(waypoint_id).getConnections().length == 2) {
        // get the whole segment

        var segments = params
          .node_index(waypoint_id)
          .getConnections()
          .map((link) =>
            this.constructor.routeSegment(params.node_index(waypoint_id), link)
          );

        // [ *-<-<-<-<-<-<,*-<-<-<-<-<-<-< ] // Get the two nodes list from node_input
        // [ >->->->->->-*,+-<-<-<-<-<-<-< ] // Change the direction to match the the shape
        // [  >->->->->->-*-<-<-<-<-<-<-<  ] // Join the Arrays keep only one node_input
        waypoint_vectors.push(
          segments[0].reverse().concat(segments[1].slice(1))
        );
      } // use the node only
      else waypoint_vectors.push([params.node_index(waypoint_id)]); // TODO

      // Save the waypoint
      params.waypoints.push(waypoint_id);
      return 0;
    };

    this.computeShape = async () => {
      let computed_shape = new Array();
      let segments = new Array();

      try {
        setShapeLinksListeners();
      } catch (error) {
        // Try again when a link in shape is invalid. Post update
        setShapeLinksListeners();
      }

      try {
        segments = getSegmentsInShapeToCoordinates();
      } catch (error) {
        // Try again when start and end nodes got updated
        segments = getSegmentsInShapeToCoordinates();
      }

      // Special case shape only one node:
      if (segments.length == 1 && segments[0].length == 1) {
        forward.setCoordinates(segments[0]);
        return segments[0];
      }

      // Concat first segment
      computed_shape = computed_shape.concat(segments[0]);

      for (let index = 1; index < segments.length; index++) {
        var segment = segments[index];

        if (
          JSON.stringify(computed_shape[computed_shape.length - 1]) ===
          JSON.stringify(segment[0])
        )
          // last from past segment equal first this segment
          computed_shape = computed_shape.concat(segment.slice(1));
        else if (
          JSON.stringify(computed_shape[computed_shape.length - 1]) ===
          JSON.stringify(segment[segment.length - 1])
        )
          // last from past segment equal last for this segment
          computed_shape = computed_shape.concat(segment.reverse().slice(1));
        else {
          // segments are not linked we need routing then
          var connection_1 = params.router
            .route([computed_shape[computed_shape.length - 1], segment[0]])
            .then((data) => data)
            .catch((error) => console.error(error));

          var connection_2 = params.router
            .route([
              computed_shape[computed_shape.length - 1],
              segment[segment.length - 1],
            ])
            .then((data) => data)
            .catch((error) => console.error(error));

          connection_1 = await connection_1;
          connection_2 = await connection_2;

          var data; // The better way to include the segment
          if (connection_1.distance < connection_2.distance) {
            data = connection_1.coordinates;
          } else {
            data = connection_2.coordinates;
            segment.reverse();
          }

          if (computed_shape[computed_shape.length - 1] == data[0])
            computed_shape = computed_shape.concat(data.slice(1));
          else computed_shape = computed_shape.concat(data);

          if (data[data.length - 1] == segment[0])
            computed_shape = computed_shape.concat(segment.slice(1));
          else computed_shape = computed_shape.concat(segment);
        }
      }

      forward.setCoordinates(computed_shape);

      return computed_shape;
    };

    this.getID = () => params.id; // TODO

    this.getCoordinates = () => {
      return forward.getCoordinates().map((l_coor) => toLonLat(l_coor));
    };

    this.getDistances = () => {
      var l_distance = 0;
      var result = [0];
      const l_a_coordinates = forward.getCoordinates().slice();

      l_a_coordinates.slice(1).forEach(
        // drop first
        // Caculates shapes distance
        (l_coor, key) => {
          var l_line = new LineString([
            l_a_coordinates[key], // tricky
            l_coor,
          ]);
          // Calculates sphere distance, better than lineal this case
          l_distance +=
            Math.round((getGeometryLength(l_line) / 1000) * 100) / 100;

          // Concatenates distance to result
          result.push(parseFloat(l_distance.toFixed(3)));
        }
      );
      return result;
    };

    this.getInfo = () => {
      return {
        id: params.id,
        points: this.getCoordinates(),
        distances: this.getDistances(),
      };
    };

    this.isValid = () => true; // TODO

    ///////////// END VARIABLE DEF /////////////
    // Setup the shape

    // Set the start and end
    if (params.start != undefined && !isNaN(params.start))
      this.setStart(params.start, false);
    if (params.end != undefined && !isNaN(params.end)) this.setEnd(params.end);

    if (params.waypoints.length) this.setWaypoints(params.waypoints);
  }

  static isInstance(obj) {
    if (typeof obj == "object") {
      if (obj.constructor.name == streetElementShape.name) {
        return true;
      }
    }
    return false;
  }

  static routeSegment(node, link) {
    // return a shape segment
    var result = [node];
    var nextNode = link.getPartner(node);

    if (nextNode) {
      // Node in the link
    } else {
      // Node not found
      return null;
    }

    if (nextNode.isValid()) {
      if (nextNode.getConnections().length > 2) {
        // It is a fork
        result.push(nextNode); // to return the fork and end execution
      } else if (
        (nextNode.getConnections().length == 1) |
        (nextNode.getType() == streetElementNode.type.ENDPOINT)
      ) {
        // Endpoint
        result.push(nextNode); // to return the endpoint and end execution
      } else {
        // return the nodes until fork/endpoint
        nextNode.getConnections().forEach((inner_link) => {
          if (inner_link != link) {
            // it is not the same link
            result = result.concat(
              // TODO, eval null return
              streetElementShape.routeSegment(nextNode, inner_link)
            );
          }
        });
      }
      return result;
    } else {
      return null;
    }
  }
}
