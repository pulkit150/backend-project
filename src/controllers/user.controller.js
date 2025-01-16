import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js'
import jwt from 'jsonwebtoken'

const generateAccessandRefreshToken = async(userId)=>{
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        // NOTE - access token is given to the user but refresh token is saved in database so that we don't have to ask password/details again &again

        // Storing refresh token in database
        user.refreshToken = refreshToken
        //user.save();// This will kikin the mongoose model as it will check for every field in the model to avoid this we use
        await user.save({validateBeforeSave: false});

        return {accessToken, refreshToken};

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh token")
    }
}

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
        // $ or is a operator of mongoDB which says check by either this or that
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
});

const loginUser = asyncHandler( async(req,res)=>{
    // req.body se data lenge
    // username or email se validate karenge(exists or nor)
    // find the user
    // password check
    // generate access and refresh token
    // send cookies(tokens)

    const {username, email, password} = req.body;

    if(!username && !email){
        throw new ApiError(400, "username or email is required")
    }

    const userExist = await User.findOne({
        $or : [{username}, {email}]
    })

    if(!userExist){
        throw new ApiError(404, "User does not exist")
    }

    const isPasswordValid = await userExist.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401, "password is not valid")
    }

    const {accessToken, refreshToken} = await generateAccessandRefreshToken(userExist._id);

    //what information we are sending to the user -->
    const loggedInUser = await User.findById(userExist._id).select("-password -refreshToken")

    //send cookies
    const options = {
        httpOnly : true,
        secure: true
        // Making these two true ensures that the cookies can't be modified by frontend side , only server side can make changes
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, refreshToken, accessToken
            },
            "User loggedIn successfully"
        )
    )
})

const logoutUser = asyncHandler( async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(
            200,{} , "user logged out successfully"
        )
    )
});

// The below code is for -> when accessToken have to get 
// refresh after hitting an endpoint(accessToken expires) by frontend

// When access token expires, the frontend sends the refresh
// token to the backend to validate user (login), once again.
const refreshAccessToken = asyncHandler(async(req,res)=>{
    
    // Accesing refreshToken from cookies for windows
    // Accessing refreshToken form body for mobile users

    const incomingRefreshToken = req.cookies.
    refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        // ?. means optionally unwrap
        const user = await User.findById(decodedToken?._id);
    
        if(!user){
            throw new ApiError(401,"invalid refresh token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await
         generateAccessandRefreshToken(user._id);
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken: accessToken, refreshToken: newRefreshToken},
                "Access token refreshed successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "invalid refresh token")
    }

})

const changeCurrentPassword = asyncHandler(async(req,res)=>{

    const {oldPassword, newPassword} = req.body;

    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid old password")
    }

    user.password = newPassword;
    await user.save({validateBeforeSave:false});

    return res
    .status(200)
    .json(new ApiResponse(200,{}, "Password changes successfully"))
})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"))
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullname, email} = req.body;

    if(!fullname || !email){
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            // Here comes the operators of MongoDB
            // set receives an object of parameters 
            $set: {
                fullname: fullname,
                email: email
            }
        },
        {new: true} // doing this will do --> update hone ke baad jo info hai woh return hoti hai 
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
})

const updateUserAvatar = asyncHandler(async(req,res)=>{
    // Here we require only one file
    const avatarLocalPath = req.file?.path;

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if(!avatar.url){
        throw new ApiError(400, "Error while uploading avatar")
    }

    const userAvatar = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url // we only need to fill the url as per our model of user
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, userAvatar, "Avatar updated successfully"))
})


const updateUserCoverImage = asyncHandler(async(req,res)=>{
    // Here we require only one file
    const coverImageLocalPath = req.file?.path;

    if(!coverImageLocalPath){
        throw new ApiError(400,"CoverImage file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading CoverImage")
    }

    const userCoverImage = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url // we only need to fill the url as per our model of user
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, userCoverImage, "CoverImage updated successfully"))
})

export {
    registerUser,
    loginUser, 
    logoutUser, 
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
};