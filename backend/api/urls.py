from django.urls import path
from . import views

urlpatterns = [
    path("postings/", views.PostingsView.as_view(), name="postings"),
    path("search/", views.SearchView.as_view(), name="search"),
    path("chat/", views.ChatView.as_view(), name="chat"),
]
