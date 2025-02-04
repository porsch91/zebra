require('dotenv').config()
const bcrypt = require('bcryptjs')
const jwt = require("jsonwebtoken")
var nedb = require("./nedbAdmin")
let db = nedb.db;
let dbrefresh = nedb.dbrefresh;
var fs = require('fs'); //importing the fs module
//var Zconfig = require("./config/");


//Update Password REST API
module.exports.updatePassword = async function(req, res){
    db.find({ }, async function (err, users) {
        const user = users.find(user => user.name == req.user.name)
        username = req.user.name;
        oldpassword  = req.body.oldpassword;
        newpassword = req.body.newpassword;
        if( user == null){
            res.status(400).send("Cannot Find User")
        }
        try{
            if ( bcrypt.compareSync(oldpassword, user.password)){
                try{
                    const Salt = bcrypt.genSaltSync()
                    const hashedpassword = bcrypt.hashSync(newpassword, Salt)
                    //const user = {name: data.name, password: hashedpassword}
                    db.update({ name: user.password }, {$set: { password: hashedpassword}}, {}, function (err, numReplaced) {
                        if(err){
                            res.status(201).send("Error");
                        } else {
                            res.status(200).send("Password Updated Successfully");
                        }
                    });
                }catch(err) {
                    res.status(500).send()
                }
            }else{
                res.send("Old Password is Incorrect")
            }
        } catch(err){
            res.status(500).send()
        }
    })
}



//Login for REST API calls
module.exports.login  = async function (req, res){
    db.find({}, async function (err, users) {
        const user = users.find(user => user.name == req.body.name)
        if( user == null){
            res.status(400).send("Cannot Find User")
        }else{
            try{
                if (bcrypt.compareSync(req.body.password, user.password)){
                    //Serialise User
                    const username = {name: user.name};
                    const accessToken = generateAccessToken(username);
                    const refreshToken = jwt.sign(username, process.env.REFRESH_TOKEN);
                    dbrefresh.find({}, function(err, tokens){
                        if(err){
                            res.send(err);
                        }else{
                            if (tokens.length >= 1){
                                dbrefresh.remove({}, {multi: true}, err => {
                                    if (err) {
                                        res.send(err);
                                    }
                                });
                            }
                            dbrefresh.insert({refreshToken: refreshToken, accessToken: accessToken});
                        }
                    })
                    res.status(200).send("Welcome "+ user.name + "\nAccess Token: " + accessToken + "\nRefresh Token: " + refreshToken)
                }else{
                    res.send("Login Failed");
                }
            } catch(err){
                res.status(500).send(err)
            }
        }    
    }); 
}

module.exports.token = function(req, res){
    refreshtokendb(function(dbrefreshTokens){
        const refreshtok = req.body.token;
      if (refreshtok == null) return res.sendStatus(401)
      try{
        if (!(dbrefreshTokens[0].refreshToken).includes(refreshtok)) return res.sendStatus(403);
        jwt.verify(refreshtok, process.env.REFRESH_TOKEN, (err, user) => {
            if (err) return res.sendStatus(403);
            const accessToken = generateAccessToken({name: user.name});
            res.json({accessToken: accessToken})
        })
      }catch(err){
          res.send("Token Generation Failed");
      }
      
    })
}


module.exports.findAdmin = function (fn){
    db.find({ }, function (err, docs) {
        fn(docs); // logs all of the data in docs
    });
}

function refreshtokendb(fn){
    dbrefresh.find({ }, function (err, docs) {
        fn(docs); // logs all of the data in docs
    });
}

function generateAccessToken(user){
    return jwt.sign(user, process.env.ACCESS_TOKEN, {expiresIn: "15m"})
}

function generateAccessToken1(user, act){
    return jwt.sign(user, act, {expiresIn: "15m"})
}

module.exports.authenticateToken =function (req,res, next) {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if(token == null) return res.status(401).send("")

    jwt.verify(token, process.env.ACCESS_TOKEN, (err, user) => {
        if (err) return res.sendStatus(403).send("")
        req.user = user
        next();
    }) 

}


module.exports.formRefreshToken = function(rtoken, usersname, fn){
    var ress = {};
    refreshtokendb(function(dbrefreshTokens){
        const refreshtok = rtoken;
        if (refreshtok == null){
            fn("null token")
        } 
        try{
            if (!(dbrefreshTokens[0].refreshToken).includes(refreshtok)){
                fn("wrong token")
            } 
            jwt.verify(refreshtok, process.env.REFRESH_TOKEN, (err, user) => {
                if (err) {
                }else{
                    var username = {name: usersname};
                    const accessToken = generateAccessToken(username);
                    ress["Access"] = accessToken;
                    ress["Refresh"] = rtoken;

                    fn(ress)
                }
                
                //res.json({accessToken: accessToken})
            })
        }catch(err){
            fn("Token Generation Failed");
        }
      
    })
}

module.exports.formToken = function(user, fn){
    var res = {};
    const username = {name: user};
    const accessToken = generateAccessToken(username);
    const refreshToken = jwt.sign(username, process.env.REFRESH_TOKEN);
    dbrefresh.find({}, function(err, tokens){
        if(err){
            res.send(err);
        }else{
            if (tokens.length >= 1){
                dbrefresh.remove({}, {multi: true}, err => {
                    if (err) {
                        res.send(err);
                    }
                });
            }
            dbrefresh.insert({refreshToken: refreshToken, accessToken: accessToken });
        }
    })
    res["Access"] = accessToken;
    res["Refresh"] = refreshToken;

    fn(res);
}

//Login for UI Form
module.exports.formLogin  = async function (req, res, next){
    var accessToken;
    var refreshToken;
    db.find({}, async function (err, users) {
        const user = users.find(user => user.name == req.body.name);
        if( user == null){
            res.render("login", {lgmsg: "Login Failed"})
        }else{
            try{
                if(bcrypt.compareSync(req.body.password, user.password)){
                    if (bcrypt.compareSync('Admin', user.password)){
                        res.render("login", {data: "pwd"})
                    }else if (bcrypt.compareSync(req.body.password, user.password)){
                        //Serialise User
                        const username = {name: user.name};
                        accessToken = generateAccessToken(username);
                        refreshToken = jwt.sign(username, process.env.REFRESH_TOKEN);
                        dbrefresh.find({}, function(err, tokens){
                            if(err){
                                res.send(err);
                            }else{
                                if (tokens.length >= 1){
                                    dbrefresh.remove({}, {multi: true}, err => {
                                        if (err) {
                                            res.send(err);
                                        }
                                    });
                                }
                                dbrefresh.insert({refreshToken: refreshToken, accessToken: accessToken });
                            }
                        })
                        req.session.name = req.body.name;
                        req.session.password = user.password;
                        //res.cookie(`ZAccToken`,`${accessToken}`);
                        var redirectionUrl = req.session.redirectUrl;
                        res.redirect(redirectionUrl);
                        //next();
                    }else{
                        res.render("login", {lgmsg: "Login Failed"})
                        //res.send("Login Failed");
                    }
                }else{
                    res.render("login", {lgmsg: "Login Failed"})
                }
            } catch(err){
                res.render("login", {lgmsg: "Login Failed"})
            }
        }    
    }); 
}

function wenv(act, rft, fn){ //write to .env file
    fs.writeFile(".env", `ACCESS_TOKEN = ${act} \nREFRESH_TOKEN = ${rft}`, 'utf-8', function(err, data) {
        if (err){
            fn("error")
        } else {
            fn("Success")
        }
    })
}
//Update Paasword Form
module.exports.updatePasswordForm = async function(req, res){
    db.find({ }, async function (err, users) {
        var user = null;
        if(req.body.name != "Admin"){
            user = users.find(user => user.name == "Admin")
        }
        if(user == null){
            user = users.find(user => user.name == req.body.name)
        }
        username = req.body.name;
        oldpassword  = 'Admin';
        newpassword = req.body.newpassword;
        cpassword = req.body.cpassword;
        if( user == null){
            res.render("login", {data: "pwd"});
        }
        try{
            if ( bcrypt.compareSync(oldpassword, user.password) && newpassword === cpassword){
                try{
                    const Salt = bcrypt.genSaltSync()
                    const hashedpassword = bcrypt.hashSync(newpassword, Salt)
                    //const user = {name: data.name, password: hashedpassword}
                    //Update ENV here
                    wenv(req.body.act, req.body.rft, function(data){
                        if(data === "Success"){
                            db.update({ name: user.name }, {$set: { password: hashedpassword, name:req.body.name}}, {}, function (err, numReplaced) {
                                if(err){
                                    res.render("login", {data: "pwd"})
                                } else {
                                    const username = {name: req.body.name};
                                    const accessToken = generateAccessToken1(username, req.body.act);
                                    const refreshToken = jwt.sign(username, req.body.rft);//process.env.REFRESH_TOKEN);
                                    dbrefresh.find({}, function(err, tokens){
                                        if(err){
                                            res.render("login", {data: "pwd", cpmsg: "Failed to get data from dbrefresh"});
                                        }else{
                                            if (tokens.length >= 1){
                                                dbrefresh.remove({}, {multi: true}, err => {
                                                    if (err) {
                                                        res.render("login", {data: "pwd", cpmsg: "Failed to remove data from dbrefresh"});
                                                    }
                                                });
                                            }
                                            dbrefresh.insert({refreshToken: refreshToken, accessToken: accessToken });
                                        }
                                    })
                                    req.session.name = req.body.name;
                                    req.session.password = newpassword;
                                    var redirectionUrl = req.session.redirectUrl;
                                    res.redirect(redirectionUrl);
                                    //res.redirect("/");
                                }
                            });
                        }else{
                            res.render("login", {data: "pwd", cpmsg: "Failed to save data to .env file"})
                        }
                    })
                            
                }catch(err) {
                    res.render("login", {data: "pwd", cpmsg: err})
                }
            }else{
                res.render("login", {data: "pwd", cpmsg: "Password mismatch"})
                //res.send("")
            }
        } catch(err){
            res.render("login", {data: "pwd"})
        }
    })
}

function tformToken(user, fn){
    var res = {};
    const username = {name: user};
    const accessToken = generateAccessToken(username);
    const refreshToken = jwt.sign(username, process.env.REFRESH_TOKEN);
    dbrefresh.find({}, function(err, tokens){
        if(err){
            fn(err);
        }else{
            if (tokens.length >= 1){
                dbrefresh.remove({}, {multi: true}, err => {
                    if (err) {
                        fn(err);
                    }
                });
            }
            dbrefresh.insert({refreshToken: refreshToken, accessToken: accessToken });
            res["Access"] = accessToken;
            res["Refresh"] = refreshToken;

            fn(res);
        }
    })
    
}

module.exports.authenticateFormToken =function (req,res, next) {
    var token;
    var refreshToken;
    db.find({ name: req.session.name, password: req.session.password }, async function (err, user) {
        if(err){
            res.send("Error Validating User");
        }else{
            dbrefresh.find({}, async function (err, tokens) {
                try{
                    token = tokens[0]["accessToken"]; // get access token
                    refreshToken = tokens[0]["refreshToken"];
                }catch(e){
                    token = null; // get access token
                    refreshToken = null;
                }
                
                if(token == null){
                    tformToken(req.session.name, function(data){
                        if (data.Access){
                            console.log("New token Created");
                            next();
                        }else{
                          res.send(data)
                        }
                      })
                }
            
                jwt.verify(token, process.env.ACCESS_TOKEN, (err, user) => {
                    if (err){
                        tformToken(req.session.name, function(data){
                            if (data.Access){
                                console.log("Forbidden. New token Created");
                                next()
                            }else{
                              res.send(data)
                            }
                        })
                    }else{
                        console.log("Token Active");
                        next()
                    }
                    
                }) 
            })
        }
    });
    //const token = req.body.access;
    

}