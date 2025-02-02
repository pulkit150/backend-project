import mongoose, { isValidObjectId } from "mongoose"
import { Video } from "../models/video.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    //TODO: get all videos based on query, sort, pagination

    // calculate the number of documents to skip for pagination
    const skip = (page - 1) * limit;

    // initialize an empty fiter object to build query condition
    const filter = {};

    // Add a filter for videos owned by a specific user(if userId is provided)
    if (userId) {
        filter.owner = new mongoose.Types.ObjectId(userId);
    }

    if (query) {
        filter.$or = [
            {
                title: {
                    $regex: query,
                    $options: "i",
                },
            },
            {
                description: {
                    $regex: query,
                    $options: "i",
                },
            },
        ];
    }

    const pipeline = [
        {
            $match: filter,
        },
        {
            $sort: {
                [sortBy]: sortType === "asc" ? 1 : -1,
            },
        },
        {
            $skip: skip,
        },
        {
            $limit: parseInt(limit),
        },
    ];

    const videos = await Video.aggregate(pipeline);

    const totalCount = await Video.countDocuments(filter);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                data: videos,
                totalCount: totalCount, // Total number of matching documents
                skip: skip, // Number of documents skipped
                limit: limit, // Number of documents per page
            },
            "Videos retrieved successfully"
        )
    );

})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body
    // TODO: get video, upload to cloudinary, create video

    if (!title || !description) {
        throw new ApiError(400, "either Title or Description not mentioned");
    }

    //check if the any video with same title exists or not
    const existingVideo = await Video.findOne({ title });
    if (existingVideo) {
        throw new ApiError(409, "Video with same title already exists");
    }

    //Fetch videoFilePath and thumbnailFilePath from frontend / postman
    const videoFilePath = req.files?.videoFile[0].path;
    const thumbnailPath = req.files?.thumbnailFile[0].path;

    if (!videoFilePath) {
        throw new ApiError(400, "Video File missing");
    }
    if (!thumbnailPath) {
        throw new ApiError(400, "Thumbnail File missing");
    }

    //upload these file paths on cloudinary
    const videoFile = await uploadOnCloudinary(videoFilePath);
    const thumbnailFile = await uploadOnCloudinary(thumbnailPath);

    // validate the videoFile length
    if (videoFile.size > 500 * 1024 * 1024) {
        throw new ApiError(409, "The size of video is too large")
    }

    const duration = videoFile?.duration;
    const views = videoFile?.views;

    const video = await Video.create({
        video_url: videoFile.url,
        thumbnail_url: thumbnailFile.url,
        title,
        description,
        duration,
        views,
        owner: req.user?._id,
    });

    if (!video) {
        throw new ApiError(500, "Video upload failed")
    }

    video.isPublished = true;
    await video.save({ validateBeforeSave: false });

    return res
        .status(201)
        .json(new ApiResponse(201, video, "Video uploaded successfully"));
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id

    if (!isValidObjectId(videoId)) {
        throw new ApiError(405, "Invalid video ID")
    }

    const video = await Video.findById(videoId).populate(
        "owner", "username fullname"
    )

    if (!video) {
        throw new ApiError(400, "Video is not found")
    }

    return res
        .status(201)
        .json(new ApiResponse(200, video, "Video Fetched successfully"));
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail

    if (!isValidObjectId(videoId)) {
        throw new ApiError(405, "Invalid video ID")
    }

    const video = await Video.findById(videoId);

    if (!video) throw new ApiError(404, "Video id not found");

    const { title, description } = req.body;
    const thumbnailPath = req.file?.path;

    const updateData = { title, description };

    if (thumbnailPath) {
        if (video.thumbnail) {
            const publicId = video.thumbnail.split("/").pop().split(".")[0];
            await uploadOnCloudinary.uploader.destroy(publicId);
        }

        const thumbnail = await uploadOnCloudinary(thumbnailPath);

        if (!thumbnail.url) {
            throw new ApiError(400, "Error while uploading thumbnail");
        }

        updateData.thumbnail = thumbnail.url;
    }

    const updatedVideoDetails = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: updateData
        },
        {
            new: true,
        }
    );

    if (!updatedVideoDetails) {
        throw new ApiError(409, "Error caught in updating the details of the video")
    };

    return res
        .status(201)
        .json(new ApiResponse(201, updatedVideoDetails, "Video Details updated successfully"))

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video

    if (!isValidObjectId(videoId)) {
        throw new ApiError(405, "Invalid video ID")
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(400, "Video not found ");
    }

    if (video.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this video");
    }

    try {
        if (video.videoFile) {
            const publicId = video.videoFile.split("/").pop().split(".")[0];
            await cloudinary.uploader.destroy(publicId);
        }

        if (video.thumbnail) {
            const publicId = video.thumbnail.split("/").pop().split(".")[0];
            await cloudinary.uploader.destroy(publicId);
        }
    } catch (error) {
        throw new ApiError(500, "Error deleting video from cloudinary");
    }

    await Video.findByIdAndDelete(videoId);

    return res
        .status(201)
        .json(new ApiResponse(200, {}, "Video Deleted Successfully"));

});

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(405, "Invalid video ID")
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video with this id not found");
    }

    video.isPublished = !video.isPublished;

    const updatedVideo = await video.save({ validateBeforeSave: false });

    return res
        .status(201)
        .json(new ApiResponse(201,
            { isPublished: updatedVideo.isPublished },
            "Video publish status updated successfully"
        ));

});

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}