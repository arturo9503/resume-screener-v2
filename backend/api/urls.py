from django.urls import path
from . import views

urlpatterns = [
    path("postings/", views.postings, name="postings"),
    path("search/", views.search, name="search"),
    path("chat/", views.chat_stream, name="chat"),
]
