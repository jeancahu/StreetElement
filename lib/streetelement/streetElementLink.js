import streetElementNode from "./streetElementNode.js";

import Feature from "ol/Feature.js";
import LineString from "ol/geom/LineString.js";
import { getLength as getGeometryLength } from "ol/sphere.js";

//////////////// GTFS streetElements ///////////////////
////                                                ////
////  This library tries to encapsulate some of the ////
////  most necessary tables and elements required   ////
////  by the General Transit Feed Specification,    ////
////  format
////
////

export default class streetElementLink {
  // Link between two nodes
  constructor(params = {}) {
    // params.router // router for links

    if (Number(params.id) != NaN) {
    } // Link indentificator
    else throw Error("Link ID: " + params.id + " is not a number");

    if (streetElementNode.isInstance(params.nodeA) && params.nodeA.isValid()) {
    } // StreetElementNode object
    else throw Error("nodeA: " + params.nodeA + " is not a valid node");

    if (streetElementNode.isInstance(params.nodeB) && params.nodeB.isValid()) {
    } // StreetElementNode object
    else throw Error("nodeB: " + params.nodeB + " is not a valid node");

    if (params.layer) {
    } // OL-Layer object
    else throw Error("No layer provided");

    if (params.direction_layer) {
    } // OL-Layer object
    else throw Error("No layer provided");

    ///////////////// private data
    var link_length = "short"; // 'short' / 'long' / 'long-error' // TODO use var
    var shapes = new Array(); // Shapes the link is in

    const routed = new LineString([
      params.nodeA.getCoordinates(),
      params.nodeB.getCoordinates(),
    ]);

    const forward = new LineString([
      params.nodeA.getCoordinates(),
      params.nodeB.getCoordinates(),
    ]);

    const reverse = new LineString([
      params.nodeB.getCoordinates(),
      params.nodeA.getCoordinates(),
    ]);

    const feature_line = new Feature({
      geometry_forward: forward,
      geometry_reverse: reverse,
      name: "Direction",
    });
    feature_line.setGeometryName("geometry_forward");
    feature_line.parent = this;

    var feature_routed = new Feature({
      geometry: routed,
      name: "MultiLine",
    });
    feature_routed.parent = this;

    var updateShapes = () => {
      shapes.forEach((shape) => shape.computeShape());
    };

    //////////////////////////////////////////////////////////// TODO
    // Calculates sphere distance, better than lineal this case
    var l_distance = Math.round(getGeometryLength(forward) * 100) / 100;

    if (l_distance < 180) {
      // less than 180 meters, simple link
      link_length = "short";
    } else {
      // a long distance between nodes needs routing
      try {
        link_length = "long";
        params.router
          .route([params.nodeA.getCoordinates(), params.nodeB.getCoordinates()])
          .then((data) => {
            routed.setCoordinates(data);
            updateShapes();
          });
      } catch (err) {
        console.error("bad response on routing for long link");
        link_length = "long-error";
      }
    }

    params.layer.getSource().addFeature(feature_routed);

    ///////////////////////////////////////////////////////////
    ////// Privileged methods

    this.getID = () => params.id;

    this.getNodes = () => {
      return [params.nodeA, params.nodeB];
    };

    this.getPartner = (node) => {
      if (node.getID() == params.nodeA.getID()) return params.nodeB;
      else if (node.getID() == params.nodeB.getID()) return params.nodeA;
      return null; // else
    };

    this.isValid = () => {
      // both nodes should be valid for link to be valid
      if (
        params.layer.getSource().getFeatureByUid(feature_line.ol_uid) ||
        params.layer.getSource().getFeatureByUid(feature_routed.ol_uid)
      )
        return params.nodeA.isValid() && params.nodeB.isValid();
      else return false;
    };

    this.getCoordinatesBetween = (first_node, second_node) => {
      if (link_length === "short") {
        return [];
      } else if (link_length === "long-error") {
        return [];
      } else {
        // long
        if (
          first_node.getID() === params.nodeA.getID() &&
          second_node.getID() === params.nodeB.getID()
        )
          return routed.getCoordinates().slice(1, -1);
        // Drop first and last
        else if (
          first_node.getID() === params.nodeB.getID() &&
          second_node.getID() === params.nodeA.getID()
        )
          return routed.getCoordinates().reverse().slice(1, -1);
        // Drop first and last
        else return [];
      }
    };

    this.update = (updateParams = {}) => {
      // Update figure on map
      forward.setCoordinates([
        params.nodeA.getCoordinates(),
        params.nodeB.getCoordinates(),
      ]);
      reverse.setCoordinates([
        params.nodeB.getCoordinates(),
        params.nodeA.getCoordinates(),
      ]);

      if (link_length == "short")
        routed.setCoordinates([
          params.nodeA.getCoordinates(),
          params.nodeB.getCoordinates(),
        ]);
      else if (updateParams.routed) {
        if (link_length == "long" || link_length == "long-error") {
          try {
            link_length = "long";
            params.router
              .route([
                params.nodeA.getCoordinates(),
                params.nodeB.getCoordinates(),
              ])
              .then((data) => {
                routed.setCoordinates(data);
                // Update shapes link is in
                updateShapes();
              });
          } catch (err) {
            console.error("bad response on routing for long link");
            link_length = "long-error";
            routed.setCoordinates([
              params.nodeA.getCoordinates(),
              params.nodeB.getCoordinates(),
            ]);
          }
        }
      }
      if (updateParams.routed)
        // Update shapes link is in (shapes are routed data)
        updateShapes();
    };

    this.setDirectionFromNode = (node) => {
      if (node == params.nodeA) {
        feature_line.setGeometryName("geometry_forward");
      } else if (node == params.nodeB) {
        feature_line.setGeometryName("geometry_reverse");
      } else {
        console.error(
          "Node:" + node.getID() + " is not linked by Link:" + params.id
        );
        return;
      }
      if (
        params.direction_layer.getSource().getFeatureByUid(feature_line.ol_uid)
      ) {
      } else params.direction_layer.getSource().addFeature(feature_line);
    };

    this.hideDirection = () => {
      if (
        params.direction_layer.getSource().getFeatureByUid(feature_line.ol_uid)
      )
        params.direction_layer.getSource().removeFeature(feature_line);
    };

    this.addShape = (in_shape) => {
      if (shapes.some((l_shape) => l_shape.getID() === in_shape.getID())) {
      } else shapes.push(in_shape);
    };

    this.terminate = () => {
      // node: node who killed the link
      // delete feature // TODO
      // parent has to delete connections first

      if (params.layer.getSource().getFeatureByUid(feature_routed.ol_uid))
        params.layer.getSource().removeFeature(feature_routed);

      this.hideDirection();

      params.nodeA.removeConnection(this);
      params.nodeB.removeConnection(this);
    };

    // Update shapes link is in
    updateShapes();
  }

  static isInstance(obj) {
    if (typeof obj == "object") {
      if (obj.constructor.name == streetElementLink.name) {
        return true;
      }
    }
    return false;
  }

  static get type() {
    return {
      LINK: "link",
      DIRECTION: "arrow",
    };
  }

  static getLinkBetween(nodeA, nodeB) {
    var result = nodeA
      .getConnections()
      .filter((link) => link.getPartner(nodeA) == nodeB);
    if (result.length > 1) {
      throw Error(
        "Nodes: " +
          nodeA.getID() +
          ":" +
          nodeB.getID() +
          "; more than one link between"
      );
    } else if (result.length) {
      return result[0];
    } // else:
    return null;
  }

  static getLinksFromNode(node, exclude = []) {
    var result = [];
    var links = node.getConnections();
    links.forEach((link) => {
      //// for each link

      if (
        exclude.some((excluded_link) => {
          return link.getID() == excluded_link.getID();
        })
      ) {
        // ignore the link
      } else {
        // add the link
        result.push(link);
      }
      //// end for each link
    });
    return result;
  }
}
