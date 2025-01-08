import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js'

const registerUser = asyncHandler( async(req,res)=>{
    // get user details from frontend
    // if frontend is not ready use postman for this purpose

    // validations

    // check if user already exists: username, email

    // check for images, check for avatar..
    
    // if availabe upload on cloudinary

    // create user object- create entry in db

    // remove password and refresh token from response

    // check for user creation
    // return response --> if true

    //step-1
    /*if data is coming from body, json etc we use -> */ 
    const {fullname, username, email, password} = req.body
    console.log(email);
    

    //step-2
    /*either use if for every field or--> */
    // if(fullname === ""){
    //     throw new ApiError(400, "Full name required")
    // }

    if(
        [fullname, username, email, password].some((field)=>
        field?.trim() === "")
    ){
        throw new ApiError(400, "All fields required")
    }

    // step - 3 
    const existedUser = await User.findOne({
        // $ or is a operator which says check by either this or that
        $or : [{ username }, { email }]
    })

    if(existedUser) throw new ApiError(409,"username or email already exists")

    // step - 4
    /*this data comes from multer --> */
    /*Jaise hi submit hua multer ne usse apne server pe store karliya hai */
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath) throw new ApiError(400, "Avatar file is required");

    //step - 5
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar) throw new ApiError(400, "Avatar file is required");

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        username: username.toLowerCase(),
        password
    });

    //step - 6
    const createdUser = await User.findById(user._id).select(
        //here we mention all things which we don't require
        "-password -refreshToken"
    );

    if(!createdUser) throw new ApiError(500, "Something went wrong while regitering the user");

    //step - 7
    return res.status(201).json(
        new ApiResponse(200, createdUser, "user registered successfully")
    );
})


export {registerUser};