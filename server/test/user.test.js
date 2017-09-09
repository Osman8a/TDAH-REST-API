const chai = require('chai');
const chaiHTTP = require('chai-http');
const bcrypt = require('bcryptjs')
const app = require('./../server');
const User = require('./../models/user');
const {
  users,
  populateUsers
} = require('./seed/seed');

const expect = chai.expect;
chai.use(chaiHTTP);

populateUsers();

describe('POST /api/advisor', () => {
  it('should add a brand new user', done => {

    const email = 'luigi4@test.com';
    const password = '123abc!';

    chai.request(app)
      .post('/api/advisor')
      .send({
        email,
        password
      })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.header['x-auth']).to.exist;
        expect(res.body.email).to.be.equal('luigi4@test.com');

        if (err) return done(err);
        // We'll find the new user created
        User.findOne({
          email
        }).then(user => {
          // make sure it created the new user with the same email
          expect(user).to.be.an('object').that.exist;
          expect(user.email).to.be.equal(email);
          // make sure it hashed properly and if the password
          // match with the hashed password
          bcrypt.compare(password, user.password, (err, userPw) => {
            expect(userPw).to.be.true;
            done();
          });
        }).catch(err => done(err));
      });
  });

  it('should get error 400 if invalid user and passowrd', done => {
    chai.request(app)
      .post('/api/advisor')
      .send({
        email: 'john@mai',
        password: '45s'
      })
      .end((err, res) => {
        expect(res).to.have.status(400);
        done();
      });
  });

  it('should get error 400 if email already in use', done => {
    const {
      email,
      password,
    } = users[0];

    chai.request(app)
      .post('/api/advisor')
      .send({
        email,
        password,
      })
      .end((err, res) => {
        expect(res).to.have.status(400);
        done();
      });
  });
});

describe('POST /api/advisor/login', () => {
  it('should login an existing user', done => {
    chai.request(app)
      .post('/api/advisor/login')
      .send({
        email: users[1].email,
        password: users[1].password,
      })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.header['x-auth']).to.exist;
        expect(res.body._id).to.be.a('string').that.is.equal(users[1]._id.toHexString());
        expect(res.body.email).to.be.equal(users[1].email);

        if (err) return done(err);

        User.findById(users[1]._id).then(user => {
          expect(user.tokens).is.an('array').that.have.lengthOf(2);
          expect(user.tokens[1]).to.deep.include({
            access: 'auth',
            token: res.header['x-auth'],
          })
          done();
        }).catch(err => done(err));
      });
  });

  it('should not login if any data is incorrect', done => {
    chai.request(app)
      .post('/api/advisor/login')
      .send({
        email: 'luigi@test',
        password: '123',
      })
      .end((err, res) => {
        expect(res).to.have.status(404);
        done();
      });
  });

  it('should not login if user not found', done => {
    chai.request(app)
      .post('/api/advisor/login')
      .send({
        email: 'saitama@hotmail.com',
        password: '123abc!',
      })
      .end((err, res) => {
        expect(res).to.have.status(404);
        done();
      });
  });
});

describe('GET /api/advisor/me', () => {
  it('should get the current logedin user', done => {
    chai.request(app)
      .get('/api/advisor/me')
      .set('x-auth', users[0].tokens[0].token)
      .end((err, res) => {
        expect(res).to.have.status(200);
        done();
      });
  });

  it('should not get the current loggedin user if not authenticated', done => {
    chai.request(app)
      .get('/api/advisor/me')
      .end((err, res) => {
        expect(res).to.have.status(401);
        done();
      });
  });
});

describe('GET /api/advisor/all', () => {
  it('should get all exiting users', done => {
    chai.request(app)
      .get('/api/advisor/all')
      .set('x-auth', users[0].tokens[0].token)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('array').that.have.lengthOf(3); // post test created an user
        done();
      });
  });

  it('should not get all users if not authenticated', done => {
    chai.request(app)
      .get('/api/advisor/all')
      .end((err, res) => {
        expect(res).to.have.status(401);
        done();
      });
  });
});

describe('DELETE /api/advisor/logout', () => {
  it('should remove token from user and logout', done => {
    chai.request(app)
      .delete('/api/advisor/logout')
      .set('x-auth', users[0].tokens[0].token)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.header['x-auth']).to.not.exist;

        if (err) return done(err);
        User.findById(users[0]._id).then(user => {
          expect(user.tokens).to.have.lengthOf(0);
          expect(user.tokens).to.be.an('array').that.is.empty;
          done();
        }).catch(err => done(err));
      });

  });
  it('should not remove token if not authenticated', done => {
    chai.request(app)
      .delete('/api/advisor/logout')
      .end((err, res) => {
        expect(res).to.have.status(401);
        done();
      });
  });
});

describe('PATCH /api/advisor/me', () => {
  it('should change password and logout', done => {
    const password = '123abc!123';
    chai.request(app)
      .patch('/api/advisor/me')
      .set('x-auth', users[0].tokens[0].token)
      .send({
        password,
      })
      .end((err, res) => {
        expect(res).to.have.status(200);
        if (err) return done(err);
        User.findById(users[0]._id).then(user => {
          bcrypt.compare(password, user.password, (err, res) => {
            expect(res).to.be.true;
            expect(user.tokens).to.be.an('array').that.is.empty;
            done();
          });
        }).catch(err => done(err));
      });

  });

  it('should change and trim password and logout', done => {
    const password = '   123abc!123   ';
    const trimmedPassword = password.trim();
    chai.request(app)
      .patch('/api/advisor/me')
      .set('x-auth', users[0].tokens[0].token)
      .send({
        password,
      })
      .end((err, res) => {
        expect(res).to.have.status(200);
        if (err) return done(err);
        User.findById(users[0]._id).then(user => {
          bcrypt.compare(trimmedPassword, user.password, (err, res) => {
            expect(res).to.be.true;
            expect(user.tokens).to.be.an('array').that.is.empty;
            done();
          });
        }).catch(err => done(err));
      });
  });

  it('should change displayName and keep logged in', done => {
    const displayName = 'Pedro Luis La Rosa Doganieri';
    chai.request(app)
      .patch('/api/advisor/me')
      .set('x-auth', users[0].tokens[0].token)
      .send({
        displayName,
      })
      .end((err, res) => {
        expect(res).to.have.status(200);
        if (err) return done(err);
        User.findById(users[0]._id).then(user => {
          expect(user.displayName).to.be.equal(displayName);
          expect(user.tokens).to.have.lengthOf(1); //*
          done();
        }).catch(err => done(err));
      });
  });

  it('should not change password if invalid', done => {
    const password = '123';
    chai.request(app)
      .patch('/api/advisor/me')
      .set('x-auth', users[0].tokens[0].token)
      .send({
        password,
      })
      .end((err, res) => {
        expect(res).to.have.status(400);
        done();
      });
  });

  it('should not change data if not authenticated', done => {
    chai.request(app)
      .patch('/api/advisor/me')
      .end((err, res) => {
        expect(res).to.have.status(401);
        done();
      });
  });
});