const mysql = require('mysql');

// Configure your MySQL connection pool
const pool = mysql.createPool({
    connectionLimit: 10, // Set the limit for connections in the pool
    host: process.env.DATABASE_HOSTNAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME
});

async function getUserData(userID, columnName) {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) {
                return reject(err);
            }

            const query = `SELECT ?? FROM users WHERE userID = ?`;
            connection.query(query, [columnName, userID], (error, results) => {
                connection.release(); // Always release the connection back to the pool
                if (error) {
                    return reject(error);
                }

                if (results.length === 0) {
                    return reject(new Error('User not found'));
                }

                const data = results[0][columnName];
                resolve(data);
            });
        });
    });
}

async function getSummary(userID) {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) {
                return reject(err);
            }

            connection.query('SELECT summary FROM users WHERE userID = ?', [userID], (error, results) => {
                connection.release(); // Always release the connection back to the pool
                if (error) {
                    return reject(error);
                }

                if (results.length === 0) {
                    return reject(new Error('User not found'));
                }

                const summary = results[0].summary;
                resolve(summary);
            });
        });
    });
}

function updateUserCredit(userID, creditToAdd, summary = null) {
    if (isNaN(creditToAdd)) { // Use isNaN to check for NaN
        console.error("Invalid input: creditToAdd is not a number.");
        return 0;
    }

    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) {
                return reject(err);
            }

            connection.query('SELECT credit FROM users WHERE userID = ?', [userID], (error, results) => {
                if (error) {
                    connection.release();
                    return reject(error);
                }

                if (results.length === 0) {
                    connection.release();
                    return reject(new Error('User not found'));
                }

                const currentCredit = results[0].credit;
                const updatedCredit = currentCredit + creditToAdd;

                // Update query based on whether summary is provided
                let updateQuery = 'UPDATE users SET credit = ? WHERE userID = ?';
                let queryParams = [updatedCredit, userID];

                if (summary !== null) {
                    updateQuery = 'UPDATE users SET credit = ?, summary = ? WHERE userID = ?';
                    queryParams = [updatedCredit, summary, userID];
                }

                connection.query(updateQuery, queryParams, (error, results) => {
                    connection.release();
                    if (error) {
                        return reject(error);
                    }
                    resolve({ userID, updatedCredit, summary });
                });
            });
        });
    });
}


async function getUserOrCreate(userData) {
    return new Promise((resolve, reject) => {
        // Validate userData object structure
        if (!userData || !userData.id || !userData.first_name || !userData.last_name || !userData.email) {
            return reject(new Error('Invalid user data structure'));
        }

        // Get a connection from the pool
        pool.getConnection((err, connection) => {
            if (err) {
                return reject(err);
            }

            // Check if the user exists
            connection.query('SELECT * FROM users WHERE userID = ?', [userData.id], (error, results) => {
                if (error) {
                    connection.release(); // Release the connection back to the pool
                    return reject(error);
                }

                // If user exists, return the user data
                if (results.length > 0) {
                    connection.release(); // Release the connection back to the pool
                    // Convert the RowDataPacket to a plain object
                    const userObject = Object.assign({}, results[0]);

                    // Return the user object
                    return resolve(userObject);
                }

                // If user does not exist, create a new user
                const newUser = {
                    userID: userData.id,
                    first_name: userData.first_name,
                    last_name: userData.last_name,
                    email: userData.email,
                    favorite: '',
                    credit: 0
                };
                connection.query('INSERT INTO users SET ?', newUser, (error, results) => {
                    connection.release(); // Release the connection back to the pool
                    if (error) {
                        return reject(error);
                    }

                    // Return the newly created user object, including the generated ID
                    newUser.id = results.insertId;
                    resolve(newUser);
                });
            });
        });
    });
}

async function updateUserData(userID, columnName, newValue) {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) {
                return reject(err);
            }

            const query = `UPDATE users SET ?? = ? WHERE userID = ?`;
            connection.query(query, [columnName, newValue, userID], (error, results) => {
                connection.release(); // Always release the connection back to the pool
                if (error) {
                    return reject(error);
                }

                if (results.affectedRows === 0) {
                    return reject(new Error('User not found or no change made'));
                }

                resolve(`User data updated successfully`);
            });
        });
    });
}

async function deleteUser(userID) {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) {
                return reject(err);
            }

            const query = `DELETE FROM users WHERE userID = ?`;
            connection.query(query, [userID], (error, results) => {
                connection.release(); // Always release the connection back to the pool
                if (error) {
                    return reject(error);
                }

                if (results.affectedRows === 0) {
                    return reject(new Error('User not found or no user deleted'));
                }

                resolve(`User deleted successfully`);
            });
        });
    });
}

async function getAllUserData(userID) {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) {
                return reject(err);
            }

            const query = `SELECT * FROM users WHERE userID = ?`;
            connection.query(query, [userID], (error, results) => {
                connection.release(); // Always release the connection back to the pool
                if (error) {
                    return reject(error);
                }

                if (results.length === 0) {
                    return reject(new Error('User not found: ' + userID)); 

                }

                // Assuming that userID is unique and can only return one row
                const userData = results[0];

                resolve(userData);
            });
        });
    });
}

async function saveContactMessage(data) {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) {
                return reject(err);
            }

            const insertQuery = `INSERT INTO contacts (dataColumn) VALUES (?)`;
            connection.query(insertQuery, [data], (error, results) => {
                connection.release();
                if (error) {
                    return reject(error);
                }
                resolve(`Data inserted successfully with ID: ${results.insertId}`);
            });
        });
    });
}


module.exports = {
    getUserOrCreate,
    updateUserCredit,
    getSummary,
    getUserData,
    updateUserData,
    deleteUser,
    getAllUserData,
    saveContactMessage
}