import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import ace from "ace-builds";
ace.config.set("basePath", "/node_modules/ace-builds/src-noconflict");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
