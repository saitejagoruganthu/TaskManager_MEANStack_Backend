const express = require('express');
const app = express();
const jwt = require("jsonwebtoken");

const mongoose = require('./db/mongoose');

const port = process.env.PORT || 3000;

//Load mongoose models
const {list, task, User} = require('./db/models');

//parse json
app.use(express.json());

//To nullify the CORS error
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Methods","GET, POST, PUT, HEAD, OPTIONS, PATCH, DELETE");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-access-token,  x-refresh-token, _id");
    res.header('Access-Control-Expose-Headers','x-access-token, x-refresh-token');
    next();
});

//check whether the request has a valid JWT access token
let authenticate = (req,res,next)=>{
    let token = req.header('x-access-token');

    //verify the JWT token
    jwt.verify(token, User.getJWTSecret(), (err,decoded)=>{
        if(err)
        {
            //there was an error
            //jwt is invalid---son do not authenticate
            res.status(401).send(err);
        }
        else
        {
            //jwt is valid
            req.user_id = decoded._id;
            next();
        }
    })
}


//Verify refresh token middleware (which will be verifying the session)
let verifysession = (req,res,next)=>{
    //grab the refresh token from the request header
    let refreshToken = req.header('x-refresh-token');

    //grab the _id from the request header
    let _id = req.header("_id");
    //console.log(_id);

    User.findByIdAndToken(_id, refreshToken).then((user)=>{
        if(!user)
        {
            return Promise.reject({'error': 'User not found. make sure that the refresh token and user id are correct'});
        }

        //if the codes reaches here - the user was found
        //therefore the refresh token exists in the database - but we still have to check if it has expired or not

        req.user_id = user._id;
        req.userObject = user;
        req.refreshToken = refreshToken;

        let isSessionValid = false;

        user.sessions.forEach((session)=>{
            if(session.token === refreshToken)
            {
                //check if the session is expired
                if(User.hasRefreshTokenExpired(session.expiresAt)=== false)
                {
                    // refresh token has not expired
                    isSessionValid = true;
                }
            }
        });

        if(isSessionValid)
        {
            //the session is valid - call next() to continue
            next();
        }
        else
        {
            //the session is not valid
            return Promise.reject({
                'error':'Session is invalid'
            })
        }
    }).catch((e)=>{
        res.status(401).send(e);
    })
};

/* Route Handlers */

/* List Route Definitions Start */

/**
 * GET /lists
 * Purpose: Get all lists
 */
app.get('/lists',authenticate, (req,res)=>{
    //we want to return an array of all the lists in the database that belong to the authenticated user

    list.find({
        _userId: req.user_id
    })
        .then((lists)=>{
            res.send(lists);
    });
})

/**
 * GET /lists/:listId
 * Purpose: Get all lists
 */
 app.get('/lists/:listId',authenticate, (req,res)=>{
    //we want to return an array of all the lists in the database that belong to the authenticated user

    list.find({
        _userId: req.user_id,
        _id: req.params.listId
    })
        .then((lists)=>{
            res.send(lists);
    });
})

/**
 * POST /lists
 * Purpose: Create a List
 */
app.post('/lists',authenticate, (req,res)=>{
    //we want to create a new list and return the newly created list document back as response
    let title = req.body.title;

    if(req.body.title)
    {
        let newList = new list({
            title,
            _userId: req.user_id
        })
    
        newList.save()
            .then((listDoc)=>{
                res.send(listDoc);
            })
    }
    else
    {
        res.status(400).send({'message':'List Name is required'})
    }
    
})

/**
 * PATCH /lists/:id
 * Purpose: Update a specified list
 */
app.patch("/lists/:id",authenticate,(req,res)=>{
    //we want to update the specified list with new values given in the JSON body
    list.findOneAndUpdate({_id: req.params.id, _userId: req.user_id}, {
        $set: req.body
    })
    .then(()=>{
        res.send({'message': 'Updated Successfully'});
    })
})

/**
 * DELETE /lists/:id
 * Purpose: Delete a specified list
 */
app.delete("/lists/:id",authenticate,(req,res)=>{
    //we want to delete the specified list
    list.findOneAndDelete({_id: req.params.id, _userId: req.user_id})
        .then((deletedDoc)=>{
            res.send(deletedDoc);

            //delete all the tasks that are in the deleted list
            deleteTasksFromList(deletedDoc._id);
        });
})

/**
 * GET /lists/:listId/tasks
 * Purpose: Get all tasks in a specific list
 */
app.get('/lists/:listId/tasks', authenticate, (req,res)=>{
    //we want to return all tasks that belong to a specific list
    task.find({_listId: req.params.listId})
    .then((tasks)=>{
        res.send(tasks);
    })
})

/**
 * GET /lists/:listId/tasks/:taskId
 * Purpose: Get all tasks in a specific list
 */
 app.get('/lists/:listId/tasks/:taskId', authenticate, (req,res)=>{
    //we want to return all tasks that belong to a specific list
    task.find({
        _listId: req.params.listId,
        _id: req.params.taskId
    })
    .then((tasks)=>{
        res.send(tasks);
    })
})

/**
 * POST /lists/:listId/tasks
 * Purpose: Create a task in a specific list
 */
app.post('/lists/:listId/tasks', authenticate, (req,res)=>{

    //verify if the owner of current listId is valid or not
    list.findOne({
        _id: req.params.listId,
        _userId: req.user_id
    }).then((list)=>{
        if(list)
        {
            //list object is valid
            //therefore the currently authenticated user can create new tasks
            return true;
        }

        //else - the user object is undefined
        return false;
    }).then((canCreateTask)=>{
        if(canCreateTask)
        {
            if(req.body.title && req.body.title!='')
            {
                //we want to create a task that belong to a specific list
                let newtask = new task({
                    title: req.body.title,
                    _listId: req.params.listId
                });

                newtask.save().then((newtsk)=>{
                    res.send(newtsk);
                })
            }
            else
            {
                res.status(400).send({'message': 'Task name is required'});
            }
        }
        else
        {
            res.sendStatus(404);
        }
    })
})

/**
 * PATCH /lists/:listId/tasks/:taskId
 */
app.patch('/lists/:listId/tasks/:taskId', authenticate, (req,res)=>{

    //verify if the owner of current listId is valid or not
    list.findOne({
        _id: req.params.listId,
        _userId: req.user_id
    }).then((list)=>{
        if(list)
        {
            //list object is valid
            //therefore the currently authenticated user can update tasks
            return true;
        }

        //else - the user object is undefined
        return false;
    }).then((canUpdateTask)=>{
        if(canUpdateTask)
        {
            //we want to update a particular task in a specific list
            task.findOneAndUpdate({
                _id: req.params.taskId,
                _listId: req.params.listId
            },{
                $set: req.body
            })
                .then(()=>{
                    res.send({message: "Task Updated Successfully"});
                })
        }
        else
        {
            res.sendStatus(404);
        }
    })
})

/**
 * DELETE /lists/:listId/tasks/:taskId
 */
app.delete('/lists/:listId/tasks/:taskId', authenticate, (req,res)=>{

    //verify if the owner of current listId is valid or not
    list.findOne({
        _id: req.params.listId,
        _userId: req.user_id
    }).then((list)=>{
        if(list)
        {
            //list object is valid
            //therefore the currently authenticated user can delete tasks
            return true;
        }

        //else - the user object is undefined
        return false;
    }).then((canDeleteTask)=>{
        if(canDeleteTask)
        {
            //we want to delete a particular task in a specific list
            task.findOneAndRemove({
                _id: req.params.taskId,
                _listId: req.params.listId
            })
                .then((deletedDoc)=>{
                    res.send(deletedDoc);
                })
        }
        else
        {
            res.sendStatus(404);
        }
    })
})

/* USER ROUTES */

/**
 * POST /users
 * Purpose: Sign up
 */
app.post('/users',(req,res)=>{

    //User Sign up
    let body = req.body;
    let newUser = new User(body);

    newUser.save().then(()=>{
        return newUser.createSession();
    }).then((refreshToken)=>{
        // Session created successfully - refreshToken returned
        // now we generate an access auth token for the user

        return newUser.generateAccessAuthToken().then((accessToken)=>{
           //access auth token generated successfully, now we return an object containing the auth tokens
            return {accessToken, refreshToken}
        })
    }).then((authToken)=>{
        // Now we construct and send the response to the user with their auth tokens in the header and the user object in the body
        res.
            header('x-refresh-token', authToken.refreshToken)
            .header('x-access-token', authToken.accessToken)
            .send(newUser);
    }).catch((e)=>{
        res.status(400).send(e);
    })
})

/**
 * POST /users/login
 * Purpose: Login
 */
app.post('/users/login',(req,res)=>{
    let email = req.body.email;
    let password = req.body.password;

    User.findByCredentials(email, password).then((user)=>{
        return user.createSession().then((refreshToken)=>{
            // Session created successfully - refreshToken returned
            // now we generate an access auth token for the user

            return user.generateAccessAuthToken().then((accessToken)=>{
                //access auth token generated successfully, now we return an object containing the auth tokens
                return {accessToken, refreshToken}
            })
        }).then((authToken)=>{
            // Now we construct and send the response to the user with their auth tokens in the header and the user object in the body
            res.
                header('x-refresh-token', authToken.refreshToken)
                .header('x-access-token', authToken.accessToken)
                .send(user);
        }).catch((e)=>{
            res.status(400).send(e);
        });
    }).catch((e)=>{
        res.status(404).send(e);
    })
})


/**
 * GET /users/me/access-token
 * Purpose: generates and returns an access token
 */
app.get('/users/me/access-token',verifysession, (req,res)=>{
    // we know that the user/caller is authenticated and we have the user_id available to us.
    req.userObject.generateAccessAuthToken().then((accessToken)=>{
        res.header('x-access-token', accessToken).send({accessToken});
    }).catch((e)=>{
        res.status(400).send(e);
    })
})

/* HELPER METHODS */
let deleteTasksFromList = (_listId) =>{
    task.deleteMany({
        _listId
    }).then(()=>{
        console.log("Tasks from " + _listId + " were deleted");
    })
}


app.listen(port,()=>{
    console.log(port);
    console.log('Server is listening');
})