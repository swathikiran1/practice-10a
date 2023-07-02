const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

app = express();

app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
  }
};

initializeDbAndServer();

// User Login API

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
        SELECT
           *
        FROM
           user
        WHERE
           username = '${username}';`;

  const userDetails = await db.get(selectUserQuery);
  if (userDetails === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      userDetails.password
    );
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "namerahul");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticateToken = async (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "namerahul", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// Get States API

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
        SELECT 
            state_id AS stateId,
            state_name AS stateName,
            population
        FROM
            state;`;
  const states = await db.all(getStatesQuery);
  response.send(states);
});

// Get One State API

app.get("/states/:stateId", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
        SELECT
           state_id AS stateId,
           state_name AS stateName,
           population
        FROM
           state
        WHERE
           state_id = ${stateId};`;
  const state = await db.get(getStateQuery);
  response.send(state);
});

// Create District API

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `
        INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
        VALUES ('${districtName}',
                  ${stateId},
                  ${cases},
                  ${cured},
                  ${active},
                  ${deaths});`;
  await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

// Get One District API

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
       SELECT
          district_id AS districtId,
          district_name AS districtName,
          state_id AS stateId, 
          cases,
          cured,
          active,
          deaths
       FROM
          district
       WHERE
          district_id = ${districtId}`;

    const district = await db.get(getDistrictQuery);
    response.send(district);
  }
);

// Delete District API

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
        DELETE FROM district WHERE district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// Update District API

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
        UPDATE district
        SET district_name = '${districtName}',
            state_id = ${stateId},
            cases = ${cases},
            cured = ${cured},
            active = ${active},
            deaths = ${deaths};
        WHERE
            district_id = ${districtId};`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

// Get Stats API

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `
       SELECT
          SUM(cases) AS totalCases,
          SUM(cured) AS totalCured,
          SUM(active) AS totalActive,
          SUM(deaths) AS totalDeaths
       FROM
          district
       WHERE
          state_id = ${stateId};`;
    const stats = await db.get(getStatsQuery);
    response.send(stats);
  }
);

module.exports = app;
