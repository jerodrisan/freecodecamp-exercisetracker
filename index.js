const express = require('express')
const app = express()
const mongoose = require('mongoose')
const cors = require('cors')
const { json } = require('express/lib/response')
require('dotenv').config()

app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


app.use(express.json())
app.use(express.urlencoded({extended:true}))

mongoose.set('strictQuery',false) //Desabilitamos modo estricto de consultas. Ver que pasa si no se adaptan al modelo de esquema. 
mongoose.connect(process.env.MONGODB_URL)

/*--------*////
//Modelo de usuario
const userSchema= new mongoose.Schema({
  username:{
    type:String,
    required:true,
    minLength: 4,
    unique:true
  },
  count:{
    type:Number, 
    default:0
  },
  log:[
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exercise'   
  }]
  
})
//Serializamos la id para que nos devuelva un json en vez esta forma: _id: new ObjectId('66eb1e31cd1cd7e974411588') , de esta: 
//_id: '66eb1e31cd1cd7e974411588'
userSchema.set('toJSON', {
  transform: function(document, returnedObject) {
    returnedObject._id = returnedObject._id.toString()   
    delete returnedObject.__v   
  }
});
const User = mongoose.model('Username', userSchema)

/*-------*/
//Modelo de ejercicio
const exerciceSchema  = new mongoose.Schema({ 
  description:{
    type:String, 
    required:true,
    minLength:4  
  },
  duration:{
    type:Number,
    min:10,
    max:100
  },
  date:Date,
  user:{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'   
  }
})
exerciceSchema.set('toJSON', {
  transform: function(document, returnedObject) {
    returnedObject._id = returnedObject._id.toString()   
    delete returnedObject._id
    delete returnedObject.__v   
    delete returnedObject.user
    returnedObject.date=returnedObject.date.toDateString()
  }
});
const Exercise = mongoose.model('Exercise', exerciceSchema)




//Borrar todos los usuarios de la base de datos para limpiar los test que hace freecodecamp (los borraremos dsede la barra del navegador por comodidad)
app.get('/deletedata',async (req,res)=>{
  
  try{
    await User.deleteMany({})
    await Exercise.deleteMany({})
    res.send("datos eliminados ")
  }catch(error){
    console.error(error)
    res.status(500).send("No se pudieron elminar los datos")
  }
  
})

//Creamos el nuevo usuario en la base de datos exerciceTracker en la coleccion username
app.post('/api/users', async (req, res)=>{
  const username = req.body.username  
  const user = new User({username: username})
  try{
    const userSaved = await user.save()
    res.json(userSaved)    
  }catch(error){
    console.log(error)
    res.json({tipoerror:"nombre menor de 4 caracteres"})
  }  
})




//Creamos un post de ejercicios con el id del usuario que esta dado de alta en la base de datos
app.post('/api/users/:_id/exercises', async (req,res)=>{
  const userId=req.params._id
  const description= req.body.description
  const duration = req.body.duration  
  let date= req.body.date || new Date()
  //Buscamos la id del usuario para saber si existe. 
  //En caso de que exista metemos el ejercicio en la base de datos y si no 
  // mandamos un mensaje de error de usuario no existe  
  const user = await User.findById(userId)
  try{     
      if(user===null){
        res.json({user:'null', message:'user not found' })
      }    
  }catch(error){
    console.error(error)
  }
  //Creamos nuevo ejercicio con el id del usuario
  const exercise = new Exercise(
    {
      description: description, 
      duration:duration,
      date:date,
      user:user._id
    }
  )
  try{
    const exerciseSaved = await exercise.save()        

    //sacamos el numero de documentos que hay en la coleccion exercises
    const exercisesCount = await Exercise.countDocuments({})
    //Metemos los logs de los ejercicios en cada usuario,     
    user.log= user.log.concat(exerciseSaved)
    user.count = exercisesCount
    await user.save()

    //por ultimo mostramos el json 
    res.json({
      username:user.username, //nombre del usuario que creo el ejercicio
      duration:exerciseSaved.duration,
      description:exerciseSaved.description,
      date:exerciseSaved.date.toDateString(),
      _id:user._id //seria la id del usuario que creo el ejercicio
    })
  }catch(error){
    console.error(error)
  }
})


//Obtencion de los logs de cada usuario: 
app.get('/api/users/:_id/logs', async(req, res)=>{
  //pillamos nombre de usuario del user
  const userId =req.params._id
  //Pillamos parametros ruta query: GET user's exercise log: GET /api/users/:_id/logs?[from][&to][&limit]
  //https://3000-freecodecam-boilerplate-lm1huykuniu.ws-eu116.gitpod.io/api/users/66feff766429e96dff326fe8/logs?from=2024-01-01&to=2024-01-29&limit=4
  const {from, to, limit} = req.query
 
  try{
    //Realizamos una conexion entre las dos colecciones con populate, en caso de no poner parametros query:
    // const user = await User.findById(userId).populate('log')

    //Realizamos la conexion entre colecciones con populate pero acotando busqueda con from, to, limit:
    const obj = {
      match:{       
        date:{
          ... (from && {$gte: new Date(from)}), // fecha mayor o igual que "from"
          ... (to && {$lte: new Date (to)})     //fecha menor o igual que "from"   
        }        
      }   
    }
    const matching = (from || to) && {... obj}  
    const user = await User.findById(userId).populate({
      path:'log',
      options:{
         ...(limit && {limit: Number(limit)}) //limite de registros
        },
        ...matching  
    })
    res.json(user)    
  }catch(error){
    console.error('error realizando las operaciones', error)
    res.status(500).json({error:"internal error"})
  }
})


////Obtencion de todos los usuarios con el formato solicitado 
app.get('/api/users', async (req, res)=>{
  const users = await User.find({}, {username:1, _id:1}) //solo devolvemos los campos username e _id
  //const users =await User.find({}) //En casod e querer ver todos los campos
  res.json(users)
})



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
