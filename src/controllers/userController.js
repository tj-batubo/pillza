// Standerdized response function
import { CreateUserService, DeleteUserService, getAllUserService, getUserByIdService, UpdateUserService } from "../models/userModel.js";

const handleResponse = (res, status, message, data = null) => {

    res.status(status).json({
        status,
        message,
        data,
    });
};

export const createUser = async (req, res, next) => {
    const { name, email } = req.body;

    try {

        const newUser = await CreateUserService(name, email);
        handleResponse(res, 201, 'User Created succesfully', newUser);

    } catch (err) {
        next(err);
    }
}

export const getAllUsers = async (req, res, next) => {

    try {

        const users = await getAllUserService();
        handleResponse(res, 200, 'Users fetched succesfully', users);
        
    } catch (err) {
        next(err);
    }
}

export const getUserById = async (req, res, next) => {

    try {

        const user = await getUserByIdService(req.params.id);
        if (!user) return handleResponse(res, 404, "User Not Found");

        handleResponse(res, 200, 'Users fetched succesfully', user);
        
    } catch (err) {
        next(err);
    }
}

export const updateUser = async (req, res, next) => {

    const { name, email } = req.body;

    try {

        const updatedUser = await UpdateUserService(name, email, req.params.id);

        if (!updatedUser) return handleResponse(res, 404, "User Not Found");

        handleResponse(res, 200, 'Users Updated succesfully', updatedUser);
        
    } catch (err) {
        next(err);
    }
}

export const deleteUser = async (req, res, next) => {

    try {

        const deletedUser = await DeleteUserService(req.params.id);

        if (!deletedUser) return handleResponse(res, 404, "User Not Found");

        handleResponse(res, 200, 'Users deleted succesfully', deletedUser);
        
    } catch (err) {
        next(err);
    }
}