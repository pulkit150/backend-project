import mongoose, {Schema} from 'mongoose'
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';

// Define a model
const videoSchema = new Schema(
    {
        videoFile: {
            type: String, 
            required: [true,'Video not available'],
        },
        thumbnail: {
            type: String,
            required: true
        },
        title: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        duration: {
            type: Number,//cloudinary se lenge
            required: true
        },
        views: {
            type: Number,
            default: true
        },
        isPublished: {
            type: Boolean,
            default: true
        },
        owner:{
            type: Schema.Types.ObjectId,
            ref: "User"
        }
    },
    {timestamps:true}
)

// Apply the paginate plugin to your schema
videoSchema.plugin(mongooseAggregatePaginate);

export const Video = mongoose.model("Video", videoSchema);